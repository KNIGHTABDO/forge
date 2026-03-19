import { NextRequest, NextResponse } from 'next/server';
import { getToolHTML } from '@/lib/github';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const html = await getToolHTML(slug);
  
  if (!html) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#888;background:#f5f5f5;}</style></head><body>Tool not found</body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    );
  }
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
