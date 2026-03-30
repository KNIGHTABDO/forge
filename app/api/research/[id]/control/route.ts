import { NextRequest, NextResponse } from 'next/server';
import { loadResearchStateById, saveResearchState } from '@/lib/research';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sessionId = String(body?.sessionId || '').trim() || undefined;
    const action = String(body?.action || '').trim();

    const state = await loadResearchStateById(id, sessionId);
    if (!state) return NextResponse.json({ error: 'Research session not found' }, { status: 404 });

    if (action === 'approve-plan') {
      const finalPlan = String(body?.plan || '').trim();
      state.planApproved = true;
      state.planFinal = finalPlan || state.planDraft;
      state.phase = 'query_fanout';
      state.events.unshift({
        id: `ev_${Date.now()}`,
        at: new Date().toISOString(),
        phase: 'query_fanout',
        message: 'Research plan approved. Launching query fan-out.',
      });
    } else if (action === 'update-plan') {
      const plan = String(body?.plan || '').trim();
      if (!plan) return NextResponse.json({ error: 'Missing plan' }, { status: 400 });
      state.planDraft = plan;
      state.events.unshift({
        id: `ev_${Date.now()}`,
        at: new Date().toISOString(),
        phase: state.phase,
        message: 'Plan updated by user.',
      });
    } else if (action === 'pause') {
      state.control.paused = true;
    } else if (action === 'resume') {
      state.control.paused = false;
      if (state.phase === 'paused') state.phase = 'analyzing';
    } else if (action === 'stop') {
      state.control.stopped = true;
      state.phase = 'stopped';
      state.events.unshift({
        id: `ev_${Date.now()}`,
        at: new Date().toISOString(),
        phase: 'stopped',
        message: 'Research was stopped by user.',
      });
    } else if (action === 'follow-up') {
      const question = String(body?.question || '').trim();
      if (!question) return NextResponse.json({ error: 'Missing follow-up question' }, { status: 400 });
      state.query = `${state.query}. Follow-up: ${question}`;
      state.control.stopped = false;
      state.control.paused = false;
      state.phase = 'query_fanout';
      state.pendingQueries.unshift(question);
      state.events.unshift({
        id: `ev_${Date.now()}`,
        at: new Date().toISOString(),
        phase: 'query_fanout',
        message: `Follow-up accepted: ${question}`,
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await saveResearchState(state);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const raw = String(err?.message || 'Failed to control research job');
    const safeError = raw.includes('docs.github.com/rest') ? 'Research control backend is temporarily unavailable.' : raw;
    return NextResponse.json({ error: safeError }, { status: 500 });
  }
}
