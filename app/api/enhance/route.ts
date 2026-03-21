import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { getCopilotToken, getCopilotBaseURL } from '@/lib/copilot-token';
import { ENHANCE_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { getToolFiles } from '@/lib/github';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // Enhancement can take a while

export async function POST(req: NextRequest) {
  try {
    const { prompt, slug, currentHTML, stitchDesign } = await req.json();

    if (!slug && !currentHTML) {
      return new Response(JSON.stringify({ error: 'slug or currentHTML required' }), { status: 400 });
    }

    // 1. Get Copilot Token
    const copilotToken = await getCopilotToken();
    const baseURL = getCopilotBaseURL(copilotToken);

    // 2. Create Provider
    const copilot = createOpenAICompatible({
      name: 'github-copilot',
      baseURL,
      headers: {
        Authorization: `Bearer ${copilotToken}`,
        'editor-version': 'vscode/1.98.0',
        'editor-plugin-version': 'GitHub.copilot/1.276.0',
        'copilot-integration-id': 'vscode-chat',
      },
    });

    // 3. Prepare Context
    let context = '';
    if (slug) {
      const files = await getToolFiles(slug);
      context += '\nCURRENT_PROJECT_FILES:\n';
      for (const file of files) {
        context += `\n--- FILE: ${file.path} ---\n${file.content}\n`;
      }
    } else if (currentHTML) {
      context += `\nCURRENT_CODE:\n${currentHTML}\n`;
    }

    if (stitchDesign) {
      context += `\nSTITCH_VISUAL_REFERENCE:\nTitle: ${stitchDesign.title}\nDescription: ${stitchDesign.description}\n`;
      if (stitchDesign.htmlUrl) {
         try {
           const res = await fetch(stitchDesign.htmlUrl);
           if (res.ok) {
             const html = await res.text();
             context += `\n--- STITCH_DESIGN_HTML_SOURCE ---\n${html}\n`;
           }
         } catch (e) { console.error('Stitch fetch error', e); }
      }
    }

    // 4. Call Model
    // Using gemini-3.1-pro-preview as confirmed supported by the Copilot API.
    const result = await streamText({
      model: copilot('gemini-3.1-pro-preview'),
      system: ENHANCE_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `CONTEXT:${context}\n\nUSER_ENHANCE_REQUEST: ${prompt}` }
      ],
      temperature: 0.7,
      maxOutputTokens: 16384,
      headers: {
        'editor-version': 'vscode/1.98.0',
        'editor-plugin-version': 'GitHub.copilot/1.276.0',
        'copilot-integration-id': 'vscode-chat',
        'user-agent': 'GithubCopilot/1.276.0',
      }
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    console.error('[enhance api error]', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}
