import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest } from 'next/server';
import { getSmartGeminiKey, reportKeyFailure, reportKeySuccess, KEYS_COUNT } from '@/lib/ai-keys';
import { getCopilotToken, getCopilotBaseURL } from '@/lib/copilot-token';

export const runtime = 'nodejs';
export const maxDuration = 30;

const TITLE_SYSTEM_PROMPT = `You are a world-class product naming expert. Your ONLY job is to generate exactly 3 short, catchy, brandable product names for a web application.

STRICT RULES — FOLLOW ALL OF THEM:
1. Output ONLY valid JSON. No markdown. No explanation. No prose. No backticks. No code fences.
2. The JSON must be an array of exactly 3 objects with this shape:
   [{"title": "Name", "reason": "3-5 word rationale"}]
3. Each title MUST be:
   - 1-3 words maximum (NEVER more than 3 words)
   - Memorable, modern, and brandable (think: Notion, Stripe, Linear, Vercel, Figma)
   - Specific to the app's purpose — NOT generic words like "Dashboard", "Manager", "Tracker", "App", "Tool", "Hub" unless creatively combined
   - Easy to type as a URL slug (no special characters)
   - Unique and creative — avoid boring compound words
4. The FIRST title in the array is your TOP recommendation.
5. Do NOT repeat the user's words verbatim. Synthesize the concept into a brand name.
6. Prefer single-word names when possible (e.g. "Pulse" not "Pulse Timer").

GOOD EXAMPLES:
- Pomodoro timer → [{"title":"FocusPulse","reason":"Rhythm-based focus sessions"},{"title":"Tempo","reason":"Timing with musical energy"},{"title":"Clockwork","reason":"Precision productivity tool"}]
- Budget tracker → [{"title":"Ledgr","reason":"Modern ledger shorthand"},{"title":"CashFlow","reason":"Money movement tracker"},{"title":"Mintt","reason":"Fresh take on finances"}]

BAD EXAMPLES (never do this):
- "Company Management Dashboard" (too long, too generic)
- "My Tool" (meaningless)
- "App Manager" (boring)
- "Build me a landing page" (copying user prompt)

OUTPUT ONLY THE JSON ARRAY. NOTHING ELSE.`;

// Shared parser for title responses from any AI source
function parseTitleResponse(text: string): { title: string; reason: string }[] {
  let titles: { title: string; reason: string }[] = [];
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    titles = JSON.parse(cleaned);
  } catch {
    // Fallback: regex extract from malformed JSON
    const fallbackRegex = /"title"\s*:\s*"([^"]+)"/g;
    let match;
    while ((match = fallbackRegex.exec(text)) !== null) {
      titles.push({ title: match[1], reason: '' });
    }
  }
  // Validate: max 4 words, max 30 chars
  return titles
    .filter(t => t.title && t.title.split(/\s+/).length <= 4 && t.title.length <= 30)
    .slice(0, 3);
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, context } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: 'prompt required' }), { status: 400 });

    const userContent = context
      ? `App description: ${prompt}\n\nAdditional context: ${context}\n\nGenerate 3 creative product names for this app.`
      : `App description: ${prompt}\n\nGenerate 3 creative product names for this app.`;

    // ── TIER 1: Google API Keys ──
    let attempts = 0;
    const MAX_ATTEMPTS = Math.min(KEYS_COUNT, 3);

    while (attempts < MAX_ATTEMPTS) {
      const currentKey = getSmartGeminiKey();
      const genAI = new GoogleGenerativeAI(currentKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite-preview',
        systemInstruction: TITLE_SYSTEM_PROMPT,
        generationConfig: { temperature: 1.2, maxOutputTokens: 256 },
      });

      try {
        const result = await model.generateContent(userContent);
        const text = result.response.text().trim();
        reportKeySuccess(currentKey);

        const titles = parseTitleResponse(text);
        if (titles.length === 0) {
          console.warn('[title-gen] No valid titles from Google, retrying...');
          attempts++;
          continue;
        }

        return new Response(JSON.stringify({ titles, source: 'google' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        console.warn(`[title-gen] Google attempt ${attempts + 1} failed: ${err.message}`);
        reportKeyFailure(currentKey);
        attempts++;
      }
    }

    // ── TIER 2: GitHub Copilot Fallback (Claude Haiku 4.5) ──
    console.warn('[title-gen] All Google keys failed. Falling back to Copilot (claude-haiku-4.5)');
    try {
      const token = await getCopilotToken();
      const baseURL = getCopilotBaseURL(token);
      const copilotRes = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'editor-version': 'vscode/1.98.0',
          'editor-plugin-version': 'GitHub.copilot/1.276.0',
          'copilot-integration-id': 'vscode-chat',
          'user-agent': 'GithubCopilot/1.276.0',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4.5',
          messages: [
            { role: 'system', content: TITLE_SYSTEM_PROMPT },
            { role: 'user', content: userContent }
          ],
          temperature: 1.0,
          max_tokens: 256,
        })
      });

      if (!copilotRes.ok) {
        throw new Error(`Copilot ${copilotRes.status}: ${await copilotRes.text()}`);
      }

      const data = await copilotRes.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      const titles = parseTitleResponse(text);

      if (titles.length > 0) {
        return new Response(JSON.stringify({ titles, source: 'copilot' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (fallbackErr: any) {
      console.error('[title-gen] Copilot fallback failed:', fallbackErr.message);
    }

    // All sources failed — return empty (non-critical, UI handles gracefully)
    return new Response(JSON.stringify({ titles: [], fallback: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[title-gen] Fatal error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
