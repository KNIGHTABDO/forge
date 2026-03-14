import { GoogleGenerativeAI } from '@google/generative-ai';
import { FORGE_SYSTEM_PROMPT, PLANNER_SYSTEM_PROMPT, BUILD_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { mode, prompt, currentHTML, elementRef, images, generationMode, planContext, chatHistory } = await req.json();
  if (!prompt) return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });

  // Select system prompt based on generationMode
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const logoUrl = `${baseUrl}/logo.png`;

  let systemInstruction: string;
  if (generationMode === 'plan') {
    systemInstruction = PLANNER_SYSTEM_PROMPT;
  } else if (generationMode === 'build') {
    systemInstruction = BUILD_SYSTEM_PROMPT.replace(/{{LOGO_URL}}/g, logoUrl).replace(/{{BASE_URL}}/g, baseUrl);
  } else if (generationMode === 'chat') {
    systemInstruction = CHAT_SYSTEM_PROMPT;
  } else {
    systemInstruction = FORGE_SYSTEM_PROMPT.replace(/{{LOGO_URL}}/g, logoUrl).replace(/{{BASE_URL}}/g, baseUrl);
  }

  // Build user content
  let userContent: any;

  // Common chat context helper
  const getContext = () => {
    let context = '';
    if (chatHistory && chatHistory.length > 0) {
      context += `\nCHAT_HISTORY:\n${chatHistory.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n`;
    }
    if (planContext) context += `\nAPPROVED_PLAN:\n${planContext}\n`;
    if (currentHTML) context += `\nCURRENT_CODE:\n${currentHTML}\n`;
    return context;
  };

  if (generationMode === 'build' && planContext) {
    // Build mode: inject history + approved plan
    userContent = `${getContext()}\n\nUSER_REQUEST: ${prompt}`;
  } else if (generationMode === 'plan') {
    // Plan mode: inject history + previous plan for revision
    userContent = `${getContext()}\n\nUSER_REQUEST: ${prompt}\n\nGenerate a complete blueprint incorporates our brainstorming and any feedback.`;
  } else if (generationMode === 'chat') {
    // Chat mode: already uses context
    userContent = `CONTEXT:${getContext()}\n\nUSER_MESSAGE:\n${prompt}`;
  } else if (mode === 'edit' && currentHTML) {
    // Fast mode edit: inject history
    userContent = `${getContext()}\n\n`
      + (elementRef ? `ELEMENT_REF: ${elementRef}\n\n` : '')
      + `CHANGE_REQUEST: ${prompt}`;
  } else {
    // Fast mode create: inject history
    userContent = `${getContext()}\n\nUSER_REQUEST: ${prompt}`;
  }

  // If there are images, format as multipart array
  if (images && images.length > 0) {
    const textPart = userContent;
    userContent = images.map((img: { data: string, mimeType: string }) => ({
      inlineData: { data: img.data, mimeType: img.mimeType }
    }));
    userContent.push(textPart);
  }

  const maxTokens = generationMode === 'build' ? 65536 : 32768;

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite-preview',
    systemInstruction,
    generationConfig: { temperature: 1.0, maxOutputTokens: maxTokens },
  });

  let streamResult;
  try {
    streamResult = await model.generateContentStream(userContent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamResult.stream) {
          try {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          } catch (chunkErr) {
            // Skip malformed chunks but don't kill the stream
            console.error('[stream chunk error]', chunkErr);
          }
        }
        controller.close();
      } catch (err: any) {
        // If the stream errors, try to close gracefully
        console.error('[stream error]', err?.message || err);
        try {
          controller.close();
        } catch {
          // Already closed or errored
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
