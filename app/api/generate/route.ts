import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { getCopilotToken, getCopilotBaseURL } from '@/lib/copilot-token';
import { ORCHESTRATOR_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Max chars of project file content to inject (prevents token bloat on large projects)
const MAX_CONTEXT_CHARS = 40_000;

async function callGemini(messages: { role: 'user' | 'assistant'; content: string }[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('No GEMINI_API_KEY set');

  const google = createGoogleGenerativeAI({ apiKey });
  return streamText({
    model: google('gemini-3.1-flash-lite-preview'),
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    messages,
    temperature: 0.7,
    maxOutputTokens: 32768,
  });
}

async function callCopilot(messages: { role: 'user' | 'assistant'; content: string }[]) {
  const token = await getCopilotToken();
  const baseURL = getCopilotBaseURL(token);
  const copilot = createOpenAICompatible({
    name: 'github-copilot',
    baseURL,
    headers: {
      Authorization: `Bearer ${token}`,
      'editor-version': 'vscode/1.98.0',
      'editor-plugin-version': 'GitHub.copilot/1.276.0',
      'copilot-integration-id': 'vscode-chat',
    },
  });
  return streamText({
    model: copilot('gemini-3.1-pro-preview'),
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    messages,
    temperature: 0.7,
    maxOutputTokens: 32768,
    headers: {
      'editor-version': 'vscode/1.98.0',
      'editor-plugin-version': 'GitHub.copilot/1.276.0',
      'copilot-integration-id': 'vscode-chat',
      'user-agent': 'GithubCopilot/1.276.0',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, chatHistory, projectFiles, stitchDesign } = await req.json();

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });
    }

    // ── Build context string ──────────────────────────────────────────────────
    let context = '';

    // Inject current project files (capped to prevent token bloat)
    if (Array.isArray(projectFiles) && projectFiles.length > 0) {
      let filesText = '';
      for (const file of projectFiles) {
        const chunk = `\n--- FILE: ${file.path} ---\n${file.content}\n`;
        if ((filesText + chunk).length > MAX_CONTEXT_CHARS) break; // stop if too large
        filesText += chunk;
      }
      context += `\nCURRENT_PROJECT_FILES:${filesText}`;
    }

    // Inject Stitch design reference
    if (stitchDesign) {
      context += `\nSTITCH_VISUAL_REFERENCE:\nTitle: ${stitchDesign.title}\nDescription: ${stitchDesign.description}\n`;
      if (stitchDesign.htmlUrl) {
        try {
          const res = await fetch(stitchDesign.htmlUrl, { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const html = await res.text();
            context += `\n--- STITCH_DESIGN_HTML ---\n(Extract Tailwind classes, colors, and layout from this and replicate in React.)\n${html.slice(0, 8000)}\n---\n`;
          }
        } catch { /* Stitch fetch is best-effort */ }
      }
    }

    // ── Build messages array ──────────────────────────────────────────────────
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    // Include recent chat history (last 10 messages to stay within token limits)
    if (Array.isArray(chatHistory)) {
      const recent = chatHistory.slice(-10);
      for (const msg of recent) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: String(msg.content) });
        }
      }
    }

    // Final user message — attach context only to this message
    const finalPrompt = context
      ? `CONTEXT:${context}\n\nUSER_REQUEST: ${prompt}`
      : `USER_REQUEST: ${prompt}`;
    messages.push({ role: 'user', content: finalPrompt });

    // ── Call AI (Gemini primary, Copilot fallback, retry once on fail) ────────
    let attempt = 0;
    const MAX_ATTEMPTS = 2;

    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      try {
        let result;
        if (process.env.GEMINI_API_KEY) {
          console.log(`[API] Attempt ${attempt}: Gemini (gemini-3.1-flash-lite-preview)`);
          result = await callGemini(messages);
        } else {
          console.log(`[API] Attempt ${attempt}: Copilot fallback`);
          result = await callCopilot(messages);
        }
        return result.toTextStreamResponse();
      } catch (err: any) {
        console.error(`[API] Attempt ${attempt} failed:`, err.message);
        if (attempt >= MAX_ATTEMPTS) {
          // Both Gemini and Copilot failed — try the other one as last resort
          try {
            console.log('[API] Last resort: Copilot fallback after Gemini exhausted');
            const result = await callCopilot(messages);
            return result.toTextStreamResponse();
          } catch (finalErr: any) {
            return new Response(
              JSON.stringify({ error: `All providers failed: ${finalErr.message}` }),
              { status: 500 }
            );
          }
        }
        // Brief wait before retry
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    return new Response(JSON.stringify({ error: 'Unexpected end of retry loop' }), { status: 500 });

  } catch (err: any) {
    console.error('[orchestrator] Unhandled error:', err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500 });
  }
}
