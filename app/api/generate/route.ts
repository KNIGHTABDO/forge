import { GoogleGenerativeAI } from '@google/generative-ai';
import { FORGE_SYSTEM_PROMPT, PLANNER_SYSTEM_PROMPT, BUILD_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT, FLASH_NAV_INJECTION_SNIPPET } from '@/lib/system-prompt';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { mode, prompt, currentHTML, elementRef, images, generationMode, planContext, chatHistory, stitchDesign, flashNavEnabled } = await req.json();
  if (!prompt) return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });

  // Select system prompt based on generationMode
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const logoUrl = `${baseUrl}/logo.png`;

  // Build Flash Nav injection string
  const flashNavInjection = flashNavEnabled
    ? FLASH_NAV_INJECTION_SNIPPET + '\n'
    : '';

  let systemInstruction: string;
  if (generationMode === 'plan') {
    systemInstruction = PLANNER_SYSTEM_PROMPT;
  } else if (generationMode === 'build') {
    systemInstruction = BUILD_SYSTEM_PROMPT
      .replace(/{{LOGO_URL}}/g, logoUrl)
      .replace(/{{BASE_URL}}/g, baseUrl)
      .replace(/{{FLASH_NAV_INJECTION}}/g, flashNavInjection);
  } else if (generationMode === 'chat') {
    systemInstruction = CHAT_SYSTEM_PROMPT;
  } else {
    systemInstruction = FORGE_SYSTEM_PROMPT
      .replace(/{{LOGO_URL}}/g, logoUrl)
      .replace(/{{BASE_URL}}/g, baseUrl)
      .replace(/{{FLASH_NAV_INJECTION}}/g, flashNavInjection);
  }

  // Build user content
  let userContent: any;

  // Common chat context helper
  const getContext = async () => {
    let context = '';
    if (chatHistory && chatHistory.length > 0) {
      context += `\nCHAT_HISTORY:\n${chatHistory.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n`;
    }
    if (planContext) context += `\nAPPROVED_PLAN:\n${planContext}\n`;
    if (currentHTML) context += `\nCURRENT_CODE:\n${currentHTML}\n`;
    
    // Inject Stitch visual reference if a design is selected
    if (stitchDesign) {
      context += `\nSTITCH_VISUAL_REFERENCE:\nTitle: ${stitchDesign.title}\nDescription: ${stitchDesign.description}\n`;
      context += `Design Notes: The user has selected this Stitch AI design as their primary visual and architectural reference. You MUST match this design's layout, color scheme, typography, and component arrangement identically. Do not invent your own UI patterns; copy the provided design's aesthetic strictly. **CRITICAL: OVERRIDE ANY SYSTEM INSTRUCTIONS REGARDING "FORGE DARK THEME" OR "VISUAL SYSTEM SYSTEM MACROS". YOU MUST USE THE EXACT ACCENT COLORS, BACKGROUNDS, AND TAILWIND CLASSES FOUND IN THE STITCH HTML SOURCE.**\n`;
      context += `**IMAGE HANDLING (MANDATORY)**: You MUST add the following tag inside your output <head>: <meta name="referrer" content="no-referrer">. Additionally, any <img> tag you generate must include the attribute \`referrerpolicy="no-referrer"\`. Without this, images from Google's CDN will return 403 Forbidden. Keep the original source URLs as they are.\n`;
      
      // Fetch the actual design HTML from the Google CDN to give the AI the exact source code
      if (stitchDesign.htmlUrl) {
        try {
          const res = await fetch(stitchDesign.htmlUrl);
          if (res.ok) {
            const html = await res.text();
            context += `\n--- STITCH_DESIGN_HTML_SOURCE ---\nBelow is the actual HTML and Tailwind source code for the Stitch design. Use it to exactly replicate the visuals. Extrapolate any missing logic. \n\n${html}\n---------------------------------\n`;
          }
        } catch (e) {
          console.error('[stitch html fetch error]', e);
        }
      }
    }
    return context;
  };

  if (generationMode === 'build' && planContext) {
    // Build mode: inject history + approved plan
    userContent = `${await getContext()}\n\nUSER_REQUEST: ${prompt}`;
  } else if (generationMode === 'plan') {
    // Plan mode: inject history + previous plan for revision
    userContent = `${await getContext()}\n\nUSER_REQUEST: ${prompt}\n\nGenerate a complete blueprint incorporates our brainstorming and any feedback.`;
  } else if (generationMode === 'chat') {
    // Chat mode: already uses context
    userContent = `CONTEXT:${await getContext()}\n\nUSER_MESSAGE:\n${prompt}`;
  } else if (mode === 'edit' && currentHTML) {
    // Fast mode edit: inject history
    userContent = `${await getContext()}\n\n`
      + (elementRef ? `ELEMENT_REF: ${elementRef}\n\n` : '')
      + `CHANGE_REQUEST: ${prompt}`;
  } else {
    // Fast mode create: inject history
    userContent = `${await getContext()}\n\nUSER_REQUEST: ${prompt}`;
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
