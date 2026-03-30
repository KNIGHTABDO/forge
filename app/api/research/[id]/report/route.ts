import { NextRequest, NextResponse } from 'next/server';
import { loadResearchStateById } from '@/lib/research';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const sessionId = req.nextUrl.searchParams.get('session') || undefined;
    const format = req.nextUrl.searchParams.get('format') || 'json';

    const state = await loadResearchStateById(id, sessionId);
    if (!state) return NextResponse.json({ error: 'Research session not found' }, { status: 404 });
    if (!state.report) return NextResponse.json({ error: 'Report is not ready yet' }, { status: 409 });

    if (format === 'md') {
      return new Response(state.report.markdown, {
        status: 200,
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': `attachment; filename="research-${id}.md"`,
        },
      });
    }

    return NextResponse.json(state.report);
  } catch (err: any) {
    const raw = String(err?.message || 'Failed to read report');
    const safeError = raw.includes('docs.github.com/rest') ? 'Research report backend is temporarily unavailable.' : raw;
    return NextResponse.json({ error: safeError }, { status: 500 });
  }
}
