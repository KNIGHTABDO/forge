import { NextRequest, NextResponse } from 'next/server';
import { advanceResearchState, loadResearchStateById, saveResearchState } from '@/lib/research';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sessionId = req.nextUrl.searchParams.get('session') || undefined;
    const shouldAdvance = req.nextUrl.searchParams.get('advance') !== '0';

    const state = await loadResearchStateById(id, sessionId);
    if (!state) return NextResponse.json({ error: 'Research session not found' }, { status: 404 });

    let nextState = state;
    const isFinished = state.phase === 'complete' || state.phase === 'stopped' || state.phase === 'error';

    if (shouldAdvance && !isFinished) {
      const last = new Date(state.lastAdvancedAt || state.updatedAt).getTime();
      const elapsedMs = Number.isFinite(last) ? Math.max(0, Date.now() - last) : 0;
      if (!isFinished) {
        // Catch-up slices simulate fire-and-forget background continuity after tab close.
        const slices = Math.max(1, Math.min(6, Math.floor(elapsedMs / 2500) || 1));
        let changed = false;
        for (let i = 0; i < slices; i += 1) {
          nextState = await advanceResearchState(nextState);
          changed = true;
          if (nextState.phase === 'complete' || nextState.phase === 'stopped' || nextState.phase === 'error') break;
        }
        if (changed) {
          await saveResearchState(nextState);
        }
      }
    }

    return NextResponse.json({
      id: nextState.id,
      query: nextState.query,
      phase: nextState.phase,
      progress: nextState.progress,
      etaMinutes: nextState.etaMinutes,
      planDraft: nextState.planDraft,
      planFinal: nextState.planFinal,
      planApproved: nextState.planApproved,
      stats: nextState.stats,
      control: nextState.control,
      websites: nextState.websites.slice(0, 60),
      learnedSoFar: nextState.learnedSoFar,
      events: nextState.events.slice(0, 80),
      chat: nextState.chat || [],
      hasReport: Boolean(nextState.report),
      completedAt: nextState.completedAt,
      error: nextState.error,
    });
  } catch (err: any) {
    const raw = String(err?.message || 'Failed to load research status');
    const safeError = raw.includes('docs.github.com/rest') ? 'Research status backend is temporarily unavailable.' : raw;
    return NextResponse.json({ error: safeError }, { status: 500 });
  }
}
