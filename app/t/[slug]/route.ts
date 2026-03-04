import { NextRequest } from 'next/server';
import { getToolHTML } from '@/lib/github';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return new Response('Invalid slug', { status: 400 });

  const html = await getToolHTML(slug);

  if (!html) {
    const notFound = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Not Found — FORGE</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#f1f5f9;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px}h1{font-size:2rem;font-weight:700}p{color:#64748b}a{color:#3b82f6;text-decoration:none}</style></head><body><h1>Tool not found</h1><p>No tool exists at this URL.</p><a href="${process.env.NEXT_PUBLIC_BASE_URL}/build">← Build your own</a></body></html>`;
    return new Response(notFound, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const editBanner = `<style>#forge-banner{position:fixed;top:0;left:0;right:0;z-index:9999;background:#111111;border-bottom:1px solid #1e293b;display:flex;align-items:center;justify-content:space-between;padding:8px 16px;font-family:system-ui,sans-serif;font-size:13px;color:#94a3b8;gap:12px}#forge-banner a{color:#3b82f6;text-decoration:none;font-weight:500;padding:4px 10px;border:1px solid #1e2d4a;border-radius:6px}#forge-banner-spacer{height:41px}</style><div id="forge-banner"><span>⚒ <strong style="color:#f1f5f9">${slug}</strong></span><a href="${process.env.NEXT_PUBLIC_BASE_URL}/build?tool=${slug}">Edit in FORGE →</a></div><div id="forge-banner-spacer"></div>`;

  const patched = html.includes('<body') ? html.replace(/(<body[^>]*>)/i, `$1\n${editBanner}`) : editBanner + html;

  return new Response(patched, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
