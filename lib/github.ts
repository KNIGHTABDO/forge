import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const OWNER = process.env.GITHUB_OWNER!;
const REPO  = process.env.GITHUB_REPO!;
const BRANCH = 'main';

export async function fileExists(path: string): Promise<boolean> {
  try {
    await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
    return true;
  } catch {
    return false;
  }
}

export async function readFile(path: string): Promise<string | null> {
  try {
    const res = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
    const data = res.data as { content?: string; encoding?: string };
    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeFile(path: string, content: string, message: string, isBase64: boolean = false): Promise<void> {
  const encoded = isBase64 ? content : Buffer.from(content, 'utf-8').toString('base64');
  let sha: string | undefined;
  try {
    const existing = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
    const data = existing.data as { sha?: string };
    sha = data.sha;
  } catch {}
  await octokit.repos.createOrUpdateFileContents({
    owner: OWNER, repo: REPO, path, message, content: encoded, branch: BRANCH,
    ...(sha ? { sha } : {}),
  });
}

export async function toolExists(slug: string): Promise<boolean> {
  return fileExists(`tools/${slug}/index.html`);
}

export async function getToolHTML(slug: string): Promise<string | null> {
  return readFile(`tools/${slug}/index.html`);
}

export async function getToolMeta(slug: string): Promise<ForgeMeta | null> {
  const raw = await readFile(`tools/${slug}/forge.json`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function deployTool(slug: string, html: string, meta: ForgeMeta): Promise<void> {
  const commitMsg = meta.promptHistory?.at(-1)?.content
    ? `[${slug}] ${meta.promptHistory.at(-1)!.content.slice(0, 72)}`
    : `Deploy ${slug}`;
  await writeFile(`tools/${slug}/index.html`, html, commitMsg);
  await writeFile(`tools/${slug}/forge.json`, JSON.stringify(meta, null, 2), `meta: ${slug}`);
  await updateGalleryIndex(slug, meta);
}

async function updateGalleryIndex(slug: string, meta: ForgeMeta): Promise<void> {
  const raw = await readFile('index.json');
  const index: GalleryEntry[] = raw ? JSON.parse(raw) : [];
  const existing = index.findIndex(e => e.slug === slug);
  const entry: GalleryEntry = { slug, title: meta.title, description: meta.description, tags: meta.tags, created: meta.created, updated: new Date().toISOString() };
  if (existing >= 0) index[existing] = entry;
  else index.unshift(entry);
  await writeFile('index.json', JSON.stringify(index, null, 2), `index: update ${slug}`);
}

export async function getGalleryIndex(): Promise<GalleryEntry[]> {
  const raw = await readFile('index.json');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export interface ForgeMeta {
  title: string; description: string; tags: string[];
  created: string; updated: string;
  promptHistory: { role: 'user' | 'assistant'; content: string; at: string }[];
}

export interface GalleryEntry {
  slug: string; title: string; description: string;
  tags: string[]; created: string; updated: string;
}

export interface SessionState {
  messages: any[];
  planContent: string;
  currentHTML: string;
  mode: 'fast' | 'plan' | 'build';
  toolName: string;
}

export async function saveSession(sessionId: string, state: SessionState): Promise<void> {
  await writeFile(`sessions/${sessionId}/state.json`, JSON.stringify(state, null, 2), `Save session ${sessionId}`);
}

export async function loadSession(sessionId: string): Promise<SessionState | null> {
  const raw = await readFile(`sessions/${sessionId}/state.json`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function uploadAsset(sessionId: string, filename: string, base64Data: string): Promise<string> {
  const path = `sessions/${sessionId}/assets/${filename}`;
  await writeFile(path, base64Data, `Upload asset ${filename} to session ${sessionId}`, true);
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/refs/heads/${BRANCH}/${path}`;
}

export async function deleteFile(path: string, message: string): Promise<void> {
  try {
    const existing = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
    const data = existing.data as { sha?: string };
    if (data.sha) {
      await octokit.repos.deleteFile({
        owner: OWNER, repo: REPO, path, message, sha: data.sha, branch: BRANCH
      });
    }
  } catch (err) {
    console.error(`Failed to delete ${path}:`, err);
  }
}

export async function deleteDirectory(path: string, message: string): Promise<void> {
  try {
    const existing = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
    if (Array.isArray(existing.data)) {
      for (const item of existing.data) {
        if (item.type === 'file') {
          await deleteFile(item.path, message);
        } else if (item.type === 'dir') {
          await deleteDirectory(item.path, message);
        }
      }
    } else {
      await deleteFile(path, message);
    }
  } catch (err) {
    console.error(`Failed to delete directory ${path}:`, err);
  }
}

export async function listDirectory(path: string): Promise<any[]> {
  try {
    const res = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
    if (Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  } catch {
    return [];
  }
}

export async function deleteToolFromGallery(slug: string): Promise<void> {
  const index = await getGalleryIndex();
  const newIndex = index.filter(e => e.slug !== slug);
  await writeFile('index.json', JSON.stringify(newIndex, null, 2), `index: remove ${slug}`);
  await deleteDirectory(`tools/${slug}`, `Delete tool ${slug}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteDirectory(`sessions/${sessionId}`, `Delete session ${sessionId}`);
}
