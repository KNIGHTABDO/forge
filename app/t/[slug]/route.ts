import { NextRequest } from 'next/server';
import { getToolHTML, getToolMeta } from '@/lib/github';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return new Response('Invalid slug', { status: 400 });

  const [html, meta] = await Promise.all([getToolHTML(slug), getToolMeta(slug)]);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  if (!html) {
    const notFound = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Tool not found \u2014 FORGE</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0D0D10;color:#F0EFFF;font-family:'Inter',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:20px;text-align:center;padding:24px}h1{font-size:2rem;font-weight:700;letter-spacing:-0.03em}p{color:#9896B8;font-size:1rem;max-width:360px;line-height:1.6}.btn{display:inline-block;margin-top:8px;background:#6C5CE7;color:#fff;text-decoration:none;padding:10px 24px;border-radius:10px;font-weight:600;font-size:0.9rem;box-shadow:0 0 20px rgba(108,92,231,0.2)}.btn:hover{background:#7D6FF0}.hint{font-size:0.78rem;color:#5C5A7A;margin-top:4px}</style></head><body><div style="font-size:2.5rem;opacity:0.15">\u2692</div><h1>Tool not found</h1><p>No tool exists at <code style="color:#A89FF5;font-size:0.85rem;background:rgba(108,92,231,0.1);padding:2px 6px;border-radius:4px">/t/${slug}</code>. It may have been deleted or never built.</p><a href="${baseUrl}/build" class="btn">\u2192 Build your own</a><p class="hint">or <a href="${baseUrl}" style="color:#A89FF5;text-decoration:none">browse existing tools</a></p></body></html>`;
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
    html, body { height: 100%; background: #0D0D10; font-family: 'Inter', system-ui, sans-serif; }

    #forge-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 48px;
      z-index: 9999;
      background: rgba(13,13,16,0.9);
      backdrop-filter: blur(20px) saturate(180%);
      -webkit-backdrop-filter: blur(20px) saturate(180%);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      gap: 12px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.4);
    }
    .forge-brand { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; }
    .forge-brand-logo { font-size: 14px; font-weight: 800; color: #F0EFFF; letter-spacing: -0.02em; flex-shrink: 0; }
    .forge-brand-sep { color: rgba(255,255,255,0.2); flex-shrink: 0; }
    .forge-title { color: #9896B8; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .forge-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .forge-btn {
      color: #9896B8;
      text-decoration: none;
      font-size: 12px;
      font-weight: 500;
      padding: 5px 12px;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 6px;
      white-space: nowrap;
      cursor: pointer;
      background: rgba(26,26,34,0.8);
      font-family: inherit;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .forge-btn:hover { background: rgba(33,33,45,0.9); color: #F0EFFF; border-color: rgba(255,255,255,0.15); transform: translateY(-1px); }
    .forge-btn.remix { color: #A89FF5; border-color: rgba(108,92,231,0.3); background: rgba(108,92,231,0.1); }
    .forge-btn.remix:hover { background: rgba(108,92,231,0.2); color: #C4BDFF; border-color: rgba(108,92,231,0.5); }
    .forge-btn.copied { color: #00CDA8; border-color: rgba(0,205,168,0.3); background: rgba(0,205,168,0.08); }
    @media (max-width: 400px) { .forge-btn-label { display: none; } }

    #tool-frame {
      position: fixed;
      top: 48px; left: 0; right: 0; bottom: 0;
      width: 100%;
      height: calc(100% - 48px);
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
