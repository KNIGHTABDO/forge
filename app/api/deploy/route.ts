import { NextRequest, NextResponse } from 'next/server';
import { deployTool, deployProjectFiles, ForgeMeta } from '@/lib/github';
import { findAvailableSlug } from '@/lib/slugify';

export async function POST(req: NextRequest) {
  const { title, description, html, tags, promptHistory, existingSlug, files } = await req.json();
  if (!html && !files) return NextResponse.json({ error: 'html or files required' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  try {
    const slug = existingSlug ?? (await findAvailableSlug(title));
    const now = new Date().toISOString();
    const meta: ForgeMeta = { title, description: description || '', tags: tags || [], created: now, updated: now, promptHistory: promptHistory || [] };
    
    if (files && Array.isArray(files) && files.length > 0) {
      await deployProjectFiles(slug, files, meta);
    } else {
      await deployTool(slug, html, meta);
    }
    
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/t/${slug}`;
    return NextResponse.json({ slug, url });
  } catch (err) {
    console.error('[deploy]', err);
    return NextResponse.json({ error: 'Deploy failed' }, { status: 500 });
  }
}
