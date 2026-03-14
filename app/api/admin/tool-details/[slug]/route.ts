import { NextRequest, NextResponse } from 'next/server';
import { getToolHTML, getToolMeta, deployTool } from '@/lib/github';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const [html, meta] = await Promise.all([getToolHTML(slug), getToolMeta(slug)]);
    if (html === null || meta === null) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }
    return NextResponse.json({ html, meta });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { html, meta } = await req.json();
    if (!html || !meta) {
      return NextResponse.json({ error: 'Missing html or meta' }, { status: 400 });
    }
    await deployTool(slug, html, meta);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
