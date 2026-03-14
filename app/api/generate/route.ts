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
  let systemInstruction: string;
  if (generationMode === 'plan') {
    systemInstruction = PLANNER_SYSTEM_PROMPT;
  } else if (generationMode === 'build') {
    systemInstruction = BUILD_SYSTEM_PROMPT;
  } else if (generationMode === 'chat') {
    systemInstruction = CHAT_SYSTEM_PROMPT;
  } else {
    systemInstruction = FORGE_SYSTEM_PROMPT;
  }

  // Build user content
  let userContent: any;

  if (generationMode === 'build' && planContext) {
    // Build mode: inject the approved plan into the prompt
    userContent = `APPROVED_PLAN:\n${planContext}\n\nUSER_REQUEST:\n${prompt}`;
  } else if (generationMode === 'plan') {
    // Plan mode: if there's an existing plan, include it for revision
    if (planContext) {
      userContent = `PREVIOUS_PLAN (revise based on user feedback below):\n${planContext}\n\nUSER_FEEDBACK:\n${prompt}\n\nGenerate a complete revised blueprint incorporating this feedback. Output the FULL updated plan, not just the changes.`;
    } else {
      userContent = prompt;
    }
  } else if (generationMode === 'chat') {
    let chatContext = '';
    if (planContext) chatContext += `\nCURRENT_PLAN:\n${planContext}\n`;
    if (currentHTML) chatContext += `\nCURRENT_CODE:\n${currentHTML}\n`;
    if (chatHistory && chatHistory.length > 0) {
      chatContext += `\nPREVIOUS_CHAT_MESSAGES:\n${chatHistory.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n`;
    }
    
    userContent = chatContext ? `CONTEXT:${chatContext}\n\nUSER_MESSAGE:\n${prompt}` : prompt;
  } else if (mode === 'edit' && currentHTML) {
    // Fast mode edit
    let textPrompt = `CURRENT_HTML:\n${currentHTML}\n\n`
      + (elementRef ? `ELEMENT_REF: ${elementRef}\n\n` : '')
      + `CHANGE_REQUEST: ${prompt}`;
    userContent = textPrompt;
  } else {
    // Fast mode create
    userContent = prompt;
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
