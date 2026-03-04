import { NextRequest, NextResponse } from 'next/server';
import { getToolHTML, getToolMeta } from '@/lib/github';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [html, meta] = await Promise.all([getToolHTML(slug), getToolMeta(slug)]);
  if (!html) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
  return NextResponse.json({ slug, html, meta });
}
