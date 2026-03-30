import { NextRequest, NextResponse } from 'next/server';
import { buildResearchId, createResearchState, saveResearchState } from '@/lib/research';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = String(body?.query || '').trim();
    const sessionId = String(body?.sessionId || '').trim();
    const id = String(body?.id || '').trim() || buildResearchId();

    if (!query) return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const state = createResearchState({ id, sessionId, query });
    await saveResearchState(state);

    return NextResponse.json({
      id: state.id,
      sessionId: state.sessionId,
      phase: state.phase,
      progress: state.progress,
      planDraft: state.planDraft,
    });
  } catch (err: any) {
    const raw = String(err?.message || 'Failed to start research');
    const safeError = raw.includes('docs.github.com/rest') ? 'Research storage is temporarily unavailable. Please retry.' : raw;
    return NextResponse.json({ error: safeError }, { status: 500 });
  }
}
