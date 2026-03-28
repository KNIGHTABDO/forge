import { NextRequest, NextResponse } from 'next/server';
import { getToolHTML, getToolMeta, getToolFiles } from '@/lib/github';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  // Try V2 multi-file format first
  const files = await getToolFiles(slug);
  const meta = await getToolMeta(slug);
  
  if (files && files.length > 0) {
    // V2 project — return files array
    return NextResponse.json({ slug, files, meta });
  }
  
  // Fallback to V1 legacy HTML
  const html = await getToolHTML(slug);
  if (!html) return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
  return NextResponse.json({ slug, html, meta });
}
