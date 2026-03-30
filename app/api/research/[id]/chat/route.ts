import { NextRequest, NextResponse } from 'next/server';
import { loadResearchStateById, saveResearchState } from '@/lib/research';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sessionId = String(body?.sessionId || '').trim() || undefined;
    const question = String(body?.question || '').trim();

    if (!question) return NextResponse.json({ error: 'Missing question' }, { status: 400 });

    const state = await loadResearchStateById(id, sessionId);
    if (!state) return NextResponse.json({ error: 'Research session not found' }, { status: 404 });
    if (!state.report) return NextResponse.json({ error: 'Research not complete yet' }, { status: 400 });

    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: 'Missing backend AI configuration' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

    // Build massive context from report
    let contextStr = `Here is the comprehensive research report you wrote previously based on hundreds of sources:\n\n${state.report.markdown}\n\n`;
    const pastChat = state.chat || [];
    if (pastChat.length > 0) {
      contextStr += `Past conversations:\n${pastChat.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n\n`;
    }

    const prompt = `You are a professional research agent answering a follow-up question.
${contextStr}
USER QUESTION: ${question}

Instructions: Answer the question exhaustively using ONLY the context provided in the research report. Do not hallucinate outside information. Output beautifully formatted markdown.`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    state.chat = state.chat || [];
    state.chat.push({ role: 'user', content: question });
    state.chat.push({ role: 'agent', content: answer });

    await saveResearchState(state, true);
    return NextResponse.json({ success: true, chat: state.chat });

  } catch (err: any) {
    const raw = String(err?.message || 'Failed to generate chat response');
    const safeError = raw.includes('docs.github.com/rest') ? 'Research chat backend is temporarily unavailable.' : raw;
    return NextResponse.json({ error: safeError }, { status: 500 });
  }
}
