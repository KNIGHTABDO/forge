import { GoogleGenerativeAI } from '@google/generative-ai';
import { FLASH_NAV_PAGE_PROMPT } from '@/lib/system-prompt';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { intent, state, currentHTML } = await req.json();

  if (!intent) {
    return new Response(JSON.stringify({ error: 'intent required' }), { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const logoUrl = `${baseUrl}/logo.png`;

  const systemInstruction = FLASH_NAV_PAGE_PROMPT
    .replace(/{{LOGO_URL}}/g, logoUrl)
    .replace(/{{BASE_URL}}/g, baseUrl);

  // Build user content — include current HTML (truncated if huge) + state + intent
  const truncatedHTML = currentHTML
    ? currentHTML.length > 20000
      ? currentHTML.slice(0, 20000) + '\n<!-- truncated -->'
      : currentHTML
    : '';

  const stateStr = state && Object.keys(state).length > 0
    ? JSON.stringify(state, null, 2)
    : '{}';

  const userContent =
    `CURRENT_PAGE_HTML:\n${truncatedHTML}\n\n` +
    `CURRENT_APP_STATE (JSON — preserve all values in the new page):\n${stateStr}\n\n` +
    `NAVIGATION_INTENT: ${intent}`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite-preview',
    systemInstruction,
    generationConfig: { temperature: 0.9, maxOutputTokens: 32768 },
  });

  let streamResult;
  try {
    streamResult = await model.generateContentStream(userContent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }

  const encoder = new TextEncoder();
  let totalTokens = 0;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamResult.stream) {
          try {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
              totalTokens += Math.ceil(text.length / 4);
            }
          } catch (chunkErr) {
            console.error('[flash-nav stream chunk error]', chunkErr);
          }
        }
        controller.close();
      } catch (err: any) {
        console.error('[flash-nav stream error]', err?.message || err);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Token-Count': String(totalTokens),
    },
  });
}
