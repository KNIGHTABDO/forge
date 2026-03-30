import { NextRequest, NextResponse } from 'next/server';
import { loadResearchStateById } from '@/lib/research';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sessionId = req.nextUrl.searchParams.get('session') || undefined;
    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 60)));

    const state = await loadResearchStateById(id, sessionId);
    if (!state) return NextResponse.json({ error: 'Research session not found' }, { status: 404 });

    return NextResponse.json({
      events: state.events.slice(0, limit),
      websites: state.websites.slice(0, limit),
      learnedSoFar: state.learnedSoFar.slice(0, limit),
      phase: state.phase,
      progress: state.progress,
      updatedAt: state.updatedAt,
    });
  } catch (err: any) {
    const raw = String(err?.message || 'Failed to load research events');
    const safeError = raw.includes('docs.github.com/rest') ? 'Research events backend is temporarily unavailable.' : raw;
    return NextResponse.json({ error: safeError }, { status: 500 });
  }
}
