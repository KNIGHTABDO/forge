import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const res = await fetch(url);
    
    if (!res.ok) {
      return new NextResponse('Failed to fetch from Stitch CDN', { status: res.status });
    }

    const html = await res.text();
    
    // We return it with text/html and NO Content-Disposition
    // This forces the browser to open and render it, instead of downloading it.
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Failed to proxy Stitch HTML preview:', err);
    return new NextResponse('Error fetching HTML', { status: 500 });
  }
}
