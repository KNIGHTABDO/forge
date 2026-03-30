import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  log: {
    debug: () => {},
    info: () => {},
    warn: () => {}, // Silence internal API warnings like 404 logs
    error: () => {} // Silence verbose error stack traces for non-critical HTTP responses
  }
});

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
  let retries = 4;
  while (retries > 0) {
    try {
      let sha: string | undefined;
      try {
        const existing = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path, ref: BRANCH });
        const data = existing.data as { sha?: string };
        sha = data.sha;
      } catch (err) {
        // File doesn't exist yet, that's fine
      }
      await octokit.repos.createOrUpdateFileContents({
        owner: OWNER, repo: REPO, path, message, content: encoded, branch: BRANCH,
        ...(sha ? { sha } : {}),
      });
      return; // Success
    } catch (err: any) {
      if (err.status === 409 && retries > 1) {
        retries--;
        const baseDelay = 400 * Math.pow(2, 3 - retries);
        const jitter = Math.random() * 300;
        await new Promise(r => setTimeout(r, baseDelay + jitter));
        continue;
      }
      throw err;
    }
  }
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

export async function deployProjectFiles(slug: string, files: { path: string, content: string }[], meta: ForgeMeta): Promise<void> {
  const commitMsg = `[${slug}] ${meta.title} update`;
  
  try {
    // 1. Get base tree (current main branch head)
    const { data: refData } = await octokit.git.getRef({ owner: OWNER, repo: REPO, ref: `heads/${BRANCH}` });
    const baseCommitSha = refData.object.sha;
    const { data: baseCommitData } = await octokit.git.getCommit({ owner: OWNER, repo: REPO, commit_sha: baseCommitSha });
    const baseTreeSha = baseCommitData.tree.sha;

    // 2. Build new tree items
    const treeItems = files.map(file => {
      const fullPath = file.path.startsWith(`tools/${slug}/`) ? file.path : `tools/${slug}/${file.path.replace(/^\//, '')}`;
      return {
        path: fullPath,
        mode: '100644' as const,
        type: 'blob' as const,
        content: file.content
      };
    });

    // Add meta file as well
    treeItems.push({
      path: `tools/${slug}/forge.json`,
      mode: '100644' as const,
      type: 'blob' as const,
      content: JSON.stringify(meta, null, 2)
    });

    // 3. Create new tree
    const { data: newTreeData } = await octokit.git.createTree({
      owner: OWNER, repo: REPO,
      base_tree: baseTreeSha,
      tree: treeItems
    });

    // 4. Create new commit
    const { data: newCommitData } = await octokit.git.createCommit({
      owner: OWNER, repo: REPO,
      message: commitMsg,
      tree: newTreeData.sha,
      parents: [baseCommitSha]
    });

    // 5. Update ref
    await octokit.git.updateRef({
      owner: OWNER, repo: REPO,
      ref: `heads/${BRANCH}`,
      sha: newCommitData.sha
    });

    // 6. Update gallery index
    await updateGalleryIndex(slug, meta);

  } catch (err) {
    console.error('[github] Multi-file commit failed, falling back to sequential writes:', err);
    // Best effort sequential fallback if tree API fails for some reason
    for (const file of files) {
      const fullPath = file.path.startsWith(`tools/${slug}/`) ? file.path : `tools/${slug}/${file.path.replace(/^\//, '')}`;
      await writeFile(fullPath, file.content, commitMsg);
    }
    await writeFile(`tools/${slug}/forge.json`, JSON.stringify(meta, null, 2), `meta: ${slug}`);
    await updateGalleryIndex(slug, meta);
  }
}

export async function getToolFiles(slug: string): Promise<{ path: string, content: string }[]> {
  const items = await listDirectory(`tools/${slug}`);
  const files: { path: string, content: string }[] = [];
  
  for (const item of items) {
    if (item.type === 'file') {
      const content = await readFile(item.path);
      if (content !== null) {
        files.push({ path: item.path, content });
      }
    }
  }
  return files;
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
  mode: 'fast' | 'plan' | 'build' | 'enhance';
  toolName: string;
  projectFiles?: { path: string, content: string }[];
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

export async function saveCheckpoint(sessionId: string, state: SessionState): Promise<string> {
  const checkpointId = `cp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await writeFile(`sessions/${sessionId}/checkpoints/${checkpointId}.json`, JSON.stringify(state, null, 2), `Checkpoint ${checkpointId}`);
  return checkpointId;
}

export async function listCheckpoints(sessionId: string): Promise<string[]> {
  const items = await listDirectory(`sessions/${sessionId}/checkpoints`);
  return items.filter(i => i.name.endsWith('.json')).map(i => i.name.replace('.json', '')).sort().reverse();
}

export async function loadCheckpoint(sessionId: string, checkpointId: string): Promise<SessionState | null> {
  const raw = await readFile(`sessions/${sessionId}/checkpoints/${checkpointId}.json`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await deleteDirectory(`sessions/${sessionId}`, `Delete session ${sessionId}`);
}
