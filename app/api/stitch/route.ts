import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, fileExists } from '@/lib/github';

export const runtime = 'nodejs';
export const maxDuration = 120; // Stitch generation can take a few minutes

const STITCH_MCP_URL = 'https://stitch.googleapis.com/mcp';

/*
 * Stitch MCP tools (from tools/list):
 *   create_project              — creates a project container (returns project name)
 *   list_projects               — lists user's projects
 *   get_project                 — gets project details by resource name
 *   generate_screen_from_text   — generates screens inside a project (requires projectId + prompt)
 *   list_screens                — lists screens in a project (returns screenshot.downloadUrl!)
 *   get_screen                  — gets a specific screen's details
 *   edit_screens                — edits existing screens
 *   generate_variants           — generates design variants
 *
 * IMPORTANT: After generate_screen_from_text, the response does NOT include image URLs.
 * You must call list_screens to get the screenshot.downloadUrl for each screen.
 */

interface McpRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

function buildMcpCall(toolName: string, args: Record<string, unknown>, id = 1): McpRequest {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };
}

async function callStitch(mcpBody: McpRequest) {
  const apiKey = process.env.STITCH_API_KEY;
  if (!apiKey) {
    throw new Error('STITCH_API_KEY is not configured');
  }

  const res = await fetch(STITCH_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify(mcpBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stitch API error ${res.status}: ${text}`);
  }

  return res.json();
}

// Extract text content from MCP result
function extractTextContent(result: any): string[] {
  const texts: string[] = [];
  if (!result?.result?.content) return texts;
  for (const item of result.result.content) {
    if (item.type === 'text') texts.push(item.text);
  }
  return texts;
}

// Persist the Forge Stitch project ID to GitHub
const STITCH_PROJECT_PATH = 'stitch/project.json';

async function getSavedProjectId(): Promise<string | null> {
  const raw = await readFile(STITCH_PROJECT_PATH);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return data.projectId || null;
  } catch { return null; }
}

async function createAndSaveProject(): Promise<string> {
  const result = await callStitch(buildMcpCall('create_project', { title: 'Forge Designs' }));

  // Check for errors
  if (result?.result?.isError) {
    const msg = extractTextContent(result).join(' ') || 'Failed to create project';
    throw new Error(msg);
  }

  // Extract project ID from response
  const texts = extractTextContent(result);
  let projectId = '';

  for (const text of texts) {
    try {
      const parsed = JSON.parse(text);
      // Look for project name like "projects/123456"
      if (parsed.name) {
        const match = parsed.name.match(/projects\/(\d+)/);
        projectId = match ? match[1] : parsed.name;
        break;
      }
      if (parsed.projectId) { projectId = parsed.projectId; break; }
    } catch {
      // Try regex on raw text
      const m = text.match(/projects\/(\d+)/);
      if (m) { projectId = m[1]; break; }
    }
  }

  if (!projectId) {
    // Last resort: search entire response
    const raw = JSON.stringify(result);
    const m = raw.match(/projects\/(\d+)/);
    if (m) projectId = m[1];
    else throw new Error('Could not extract project ID from Stitch response');
  }

  // Save to GitHub
  await writeFile(
    STITCH_PROJECT_PATH,
    JSON.stringify({ projectId, createdAt: new Date().toISOString() }, null, 2),
    'stitch: save project ID'
  );

  return projectId;
}

async function getOrCreateProject(): Promise<string> {
  const saved = await getSavedProjectId();
  if (saved) return saved;
  return createAndSaveProject();
}

// Fetch screens with their screenshot URLs from list_screens
async function fetchScreensWithImages(projectId: string): Promise<any[]> {
  const result = await callStitch(buildMcpCall('list_screens', { projectId }));

  if (result?.result?.isError) return [];

  const texts = extractTextContent(result);
  const screens: any[] = [];

  for (const text of texts) {
    try {
      const parsed = JSON.parse(text);
      // list_screens returns { screens: [...] }
      if (parsed.screens && Array.isArray(parsed.screens)) {
        for (const s of parsed.screens) {
          const screenIdMatch = s.name?.match(/screens\/([a-f0-9]+)/);
          
          let imgUrl = s.screenshot?.downloadUrl || '';
          if (imgUrl.includes('lh3.googleusercontent.com') && !imgUrl.includes('=')) {
            imgUrl += '=s1200';
          }

          screens.push({
            id: screenIdMatch ? screenIdMatch[1] : s.name,
            name: s.name,
            title: s.title || 'Untitled',
            // The actual screenshot URL from Google (scaled up to fix blurriness)
            imageUrl: imgUrl,
            htmlUrl: s.htmlCode?.downloadUrl || '',
            width: s.width,
            height: s.height,
            deviceType: s.deviceType,
          });
        }
      }
    } catch { /* skip */ }
  }

  return screens;
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, prompt, projectId: reqProjectId, screenId } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    switch (action) {
      // ─── Clear: reset project from GitHub ───
      case 'clear': {
        const exists = await fileExists(STITCH_PROJECT_PATH);
        if (exists) {
          // Use writeFile to overwrite with empty data instead of deleting
          await writeFile(
            STITCH_PROJECT_PATH,
            JSON.stringify({ projectId: null, cleared: true, at: new Date().toISOString() }, null, 2),
            'stitch: clear project'
          );
        }
        return NextResponse.json({ success: true });
      }

      // ─── Generate: create design screens from text prompt ───
      case 'generate': {
        if (!prompt) {
          return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        // Get or create project
        const projectId = reqProjectId || await getOrCreateProject();

        // Call generate_screen_from_text
        const genResult = await callStitch(buildMcpCall('generate_screen_from_text', {
          projectId,
          prompt,
        }));

        // Check for errors
        if (genResult?.result?.isError) {
          const errMsg = extractTextContent(genResult).join(' ') || 'Generation failed';
          return NextResponse.json({ error: errMsg }, { status: 502 });
        }

        // Extract text and suggestions from the generate response
        const genTexts = extractTextContent(genResult);
        let textOutput = '';
        const suggestions: string[] = [];

        for (const text of genTexts) {
          try {
            const parsed = JSON.parse(text);
            if (parsed.outputComponents) {
              for (const comp of parsed.outputComponents) {
                if (comp.text) textOutput += comp.text + '\n';
                if (comp.suggestion) suggestions.push(comp.suggestion);
              }
            }
          } catch {
            textOutput += text + '\n';
          }
        }

        // Now fetch screens WITH their screenshot URLs via list_screens
        const screens = await fetchScreensWithImages(projectId);

        return NextResponse.json({
          success: true,
          projectId,
          screens,
          suggestions,
          text: textOutput.trim(),
        });
      }

      // ─── List screens with images ───
      case 'list_screens': {
        const pid = reqProjectId || await getSavedProjectId();
        if (!pid) {
          return NextResponse.json({ error: 'No project exists yet' }, { status: 400 });
        }
        const screens = await fetchScreensWithImages(pid);
        return NextResponse.json({ success: true, screens });
      }

      // ─── Get a specific screen ───
      case 'get_screen': {
        const pid = reqProjectId || await getSavedProjectId();
        if (!pid || !screenId) {
          return NextResponse.json({ error: 'projectId and screenId are required' }, { status: 400 });
        }
        const result = await callStitch(buildMcpCall('get_screen', {
          name: `projects/${pid}/screens/${screenId}`,
          projectId: pid,
          screenId,
        }));
        if (result?.result?.isError) {
          const msg = extractTextContent(result).join(' ') || 'Failed to get screen';
          return NextResponse.json({ error: msg }, { status: 502 });
        }
        return NextResponse.json({ success: true, data: extractTextContent(result) });
      }

      // ─── List projects ───
      case 'list_projects': {
        const result = await callStitch(buildMcpCall('list_projects', {}));
        return NextResponse.json({ success: true, data: extractTextContent(result) });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stitch proxy error]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
