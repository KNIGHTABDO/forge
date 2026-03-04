import { NextRequest } from 'next/server';
import { getToolHTML, getToolMeta } from '@/lib/github';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return new Response('Invalid slug', { status: 400 });

  const [html, meta] = await Promise.all([getToolHTML(slug), getToolMeta(slug)]);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  if (!html) {
    const notFound = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Not Found — FORGE</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#f1f5f9;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px}h1{font-size:2rem;font-weight:700}p{color:#64748b}a{color:#3b82f6;text-decoration:none}</style></head><body><h1>Tool not found</h1><p>No tool exists at this URL.</p><a href="${baseUrl}/build">← Build your own</a></body></html>`;
    return new Response(notFound, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const title = meta?.title ?? slug;
  const editUrl = `${baseUrl}/build?tool=${slug}`;

  // Encode the tool HTML as a data URI so it lives in its own iframe,
  // completely isolated from the host shell — banner never touches tool layout.
  const encoded = Buffer.from(html).toString('base64');

  const shell = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — FORGE</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: #0a0a0a; font-family: system-ui, sans-serif; }

    #forge-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 41px;
      z-index: 9999;
      background: #111111;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      font-size: 13px;
      color: #94a3b8;
      gap: 12px;
    }
    #forge-banner .forge-brand { display: flex; align-items: center; gap: 6px; }
    #forge-banner .forge-title { color: #f1f5f9; font-weight: 500; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #forge-banner a.edit-btn {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
      padding: 4px 10px;
      border: 1px solid #1e2d4a;
      border-radius: 6px;
      white-space: nowrap;
      transition: background 0.15s;
    }
    #forge-banner a.edit-btn:hover { background: #1e2d4a; }

    #tool-frame {
      position: fixed;
      top: 41px; left: 0; right: 0; bottom: 0;
      width: 100%;
      height: calc(100% - 41px);
      border: none;
    }
  </style>
</head>
<body>
  <div id="forge-banner">
    <div class="forge-brand">
      <span>&#9874;</span>
      <span class="forge-title">${title}</span>
    </div>
    <a href="${editUrl}" class="edit-btn">Edit in FORGE &#8594;</a>
  </div>
  <iframe
    id="tool-frame"
    src="data:text/html;base64,${encoded}"
    sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
    allow="clipboard-write"
  ></iframe>
</body>
</html>`;

  return new Response(shell, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
