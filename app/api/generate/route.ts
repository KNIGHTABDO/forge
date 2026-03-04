import { GoogleGenerativeAI } from '@google/generative-ai';
import { FORGE_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { NextRequest } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { mode, prompt, currentHTML, elementRef } = await req.json();
  if (!prompt) return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });

  let userContent: string;
  if (mode === 'edit' && currentHTML && elementRef) {
    userContent = `CURRENT_HTML:\n${currentHTML}\n\nELEMENT_REF: ${elementRef}\n\nCHANGE_REQUEST: ${prompt}`;
  } else {
    userContent = prompt;
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-lite',
    systemInstruction: FORGE_SYSTEM_PROMPT,
    generationConfig: { temperature: 1.0, maxOutputTokens: 32768 },
  });

  const stream = await model.generateContentStream(userContent);
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) { controller.error(err); }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked', 'X-Content-Type-Options': 'nosniff' },
  });
}
