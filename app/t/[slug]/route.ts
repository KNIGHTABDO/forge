import { NextRequest } from 'next/server';
import { getToolHTML, getToolMeta } from '@/lib/github';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return new Response('Invalid slug', { status: 400 });

  const [html, meta] = await Promise.all([getToolHTML(slug), getToolMeta(slug)]);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  if (!html) {
    const notFound = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Tool not found \u2014 FORGE</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#f1f5f9;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:20px;text-align:center;padding:24px}h1{font-size:2rem;font-weight:700;letter-spacing:-0.03em}p{color:#64748b;font-size:1rem;max-width:360px;line-height:1.6}.btn{display:inline-block;margin-top:8px;background:#3b82f6;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-weight:600;font-size:0.9rem}.btn:hover{background:#2563eb}.hint{font-size:0.78rem;color:#374151;margin-top:4px}</style></head><body><div style="font-size:2.5rem;opacity:0.15">\u2692</div><h1>Tool not found</h1><p>No tool exists at <code style="color:#3b82f6;font-size:0.85rem">/t/${slug}</code>. It may have been deleted or never built.</p><a href="${baseUrl}/build" class="btn">\u2192 Build your own</a><p class="hint">or <a href="${baseUrl}" style="color:#3b82f6;text-decoration:none">browse existing tools</a></p></body></html>`;
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
  <title>${title} \u2014 FORGE</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; background: #0a0a0a; font-family: system-ui, sans-serif; }

    #forge-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 44px;
      z-index: 9999;
      background: #111111;
      border-bottom: 1px solid #1e293b;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      gap: 12px;
    }
    .forge-brand { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; }
    .forge-brand-logo { font-size: 14px; font-weight: 800; color: #f1f5f9; letter-spacing: -0.02em; flex-shrink: 0; }
    .forge-brand-sep { color: #334155; flex-shrink: 0; }
    .forge-title { color: #94a3b8; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .forge-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .forge-btn {
      color: #94a3b8;
      text-decoration: none;
      font-size: 12px;
      font-weight: 500;
      padding: 5px 11px;
      border: 1px solid #1e293b;
      border-radius: 6px;
      white-space: nowrap;
      cursor: pointer;
      background: transparent;
      font-family: inherit;
      transition: background 0.12s, color 0.12s, border-color 0.12s;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .forge-btn:hover { background: #1e293b; color: #f1f5f9; border-color: #334155; }
    .forge-btn.remix { color: #3b82f6; border-color: #1e2d4a; }
    .forge-btn.remix:hover { background: #1e2d4a; color: #60a5fa; }
    .forge-btn.copied { color: #22c55e; border-color: rgba(34,197,94,0.3); }
    /* hide text on very small screens */
    @media (max-width: 400px) { .forge-btn-label { display: none; } }

    #tool-frame {
      position: fixed;
      top: 44px; left: 0; right: 0; bottom: 0;
      width: 100%;
      height: calc(100% - 44px);
      border: none;
    }
  </style>
</head>
<body>
  <div id="forge-banner">
    <div class="forge-brand">
      <span class="forge-brand-logo">&#9874; FORGE</span>
      <span class="forge-brand-sep">/</span>
      <span class="forge-title">${title}</span>
    </div>
    <div class="forge-actions">
      <button class="forge-btn" id="copy-btn" onclick="copyUrl()" title="Copy link">
        &#128279;<span class="forge-btn-label">Copy link</span>
      </button>
      <a href="${editUrl}" class="forge-btn remix" title="Remix in FORGE">
        &#9874;<span class="forge-btn-label">Remix</span>
      </a>
    </div>
  </div>
  <iframe
    id="tool-frame"
    src="data:text/html;base64,${encoded}"
    sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
    allow="clipboard-write"
  ></iframe>
  <script>
    function copyUrl() {
      const btn = document.getElementById('copy-btn');
      navigator.clipboard.writeText(window.location.href).then(() => {
        btn.classList.add('copied');
        btn.innerHTML = '\u2713<span class="forge-btn-label">Copied!</span>';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '&#128279;<span class="forge-btn-label">Copy link</span>';
        }, 2000);
      }).catch(() => {
        // Fallback: select all text
        const el = document.createElement('textarea');
        el.value = window.location.href;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      });
    }
  </script>
</body>
</html>`;

  return new Response(shell, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
