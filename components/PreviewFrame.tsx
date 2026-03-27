'use client';

import { useEffect, useRef } from 'react';

interface Props {
  html: string;
  isStreaming: boolean;
  inspectMode: boolean;
  onElementClick: (ref: string) => void;
  mode?: 'fast' | 'plan' | 'build' | 'enhance' | 'chat';
}

// Inspector script built via array join — avoids any </script> parsing issues.
// CRITICAL: click handlers are NOT wrapped in DOMContentLoaded — they register
// immediately on the document so they work even if the DOM is already ready.
const INSPECTOR_JS = [
  '(function(){',
  'var mode=false,ov,lb;',

  // Overlay + label for inspect mode
  'function mkOv(){',
    'if(ov)return;',
    'ov=document.createElement("div");',
    'ov.style.cssText="position:fixed;top:0;left:0;pointer-events:none;z-index:2147483646;display:none;box-sizing:border-box;transition:all .08s";',
    'document.body.appendChild(ov);',
    'lb=document.createElement("div");',
    'lb.style.cssText="position:fixed;pointer-events:none;z-index:2147483647;display:none;background:#fff;color:#000;font:600 11px system-ui,monospace;padding:3px 8px;border-radius:6px;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 12px rgba(0,0,0,.5);transition:all .08s";',
    'document.body.appendChild(lb);',
  '}',

  'function hi(el){',
    'if(!el||el===document.body||el===document.documentElement)return;',
    'var r=el.getBoundingClientRect();',
    'ov.style.cssText="position:fixed;pointer-events:none;z-index:2147483646;box-shadow:inset 0 0 0 2px #fff,0 0 0 9999px rgba(0,0,0,.4);border-radius:8px;display:block;top:"+r.top+"px;left:"+r.left+"px;width:"+r.width+"px;height:"+r.height+"px;transition:all .08s";',
    'var tag=el.tagName.toLowerCase();',
    'var txt=(el.textContent||"").trim().slice(0,24);',
    'lb.textContent=tag+(txt?" \\""+txt+"\\"":"");',
    'var t=r.top-24;if(t<4)t=r.bottom+4;',
    'var l=r.left;if(l+150>innerWidth)l=innerWidth-158;if(l<4)l=4;',
    'lb.style.top=t+"px";lb.style.left=l+"px";lb.style.display="block";',
  '}',

  'function cl(){if(ov){ov.style.display="none";lb.style.display="none";}}',

  'function desc(el){',
    'var t=el.tagName.toLowerCase(),x=(el.textContent||"").trim().slice(0,50);',
    'var a=el.getAttribute("aria-label")||el.getAttribute("placeholder")||"";',
    'var d="the <"+t+">";',
    'if(a)d+=" labeled \\""+a+"\\"";else if(x)d+=" saying \\""+x+"\\"";',
    'if(el.id)d+=" (#"+el.id+")";return d;',
  '}',

  // Listen for inspect toggle from Forge parent
  'window.addEventListener("message",function(e){',
    'if(e.data&&e.data.__forge){',
      'mode=e.data.__forge==="inspect_on";',
      'if(!mode)cl();',
      'if(document.body)document.body.style.cursor=mode?"crosshair":"";',
    '}',
  '});',

  // === CLICK HANDLER — registered immediately, not inside DOMContentLoaded ===
  'document.addEventListener("click",function(e){',
    // Inspect mode: describe element and send to parent
    'if(mode){',
      'e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();cl();',
      'window.parent.postMessage({__forge_click:desc(e.target)},"*");',
      'return;',
    '}',
    // Normal mode: check if click target is or is inside a link
    'var a=e.target.closest?e.target.closest("a[href], button"):null;',
    'if(a){',
      'var h=a.getAttribute("data-forge-href")||a.getAttribute("href")||"";',
      'var txt=(a.textContent||"").trim().slice(0,40);',
      // Allow pure empty hash or javascript void directly if it's not a real nav action (unless it has text, then we block it for flash nav)
      'if((h==="#"||h===""||h.startsWith("javascript:"))&&!txt)return;',
      // Handle #anchor scrolls internally
      'if(h.charAt(0)==="#"){',
        'e.preventDefault();e.stopPropagation();',
        'try{var el=document.querySelector(h);if(el)el.scrollIntoView({behavior:"smooth"});}catch(x){}',
        'return;',
      '}',
      // Block ALL other navigation (relative, absolute, external, or disabled links with text)
      'e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();',
      'window.parent.postMessage({__forge_nav_blocked:{href:h,text:txt,tag:a.tagName.toLowerCase()}},"*");',
      'return;',
    '}',
  '},true);',

  // Block all form submissions
  'document.addEventListener("submit",function(e){',
    'e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();',
    'window.parent.postMessage({__forge_nav_blocked:{href:"form_submit",text:"Form Submit",tag:"form"}},"*");',
  '},true);',

  // Setup overlays when body is available
  'function trySetup(){if(document.body)mkOv();else setTimeout(trySetup,50);}',
  'trySetup();',

  // Hover handlers for inspect mode
  'document.addEventListener("mouseover",function(e){if(mode&&ov)hi(e.target);},true);',
  'document.addEventListener("mouseout",function(){if(mode)cl();},true);',

  // Override window.open
  'window.open=function(){window.parent.postMessage({__forge_nav_blocked:{href:"popup",text:"Popup",tag:"window"}},"*");};',

  '}())',
].join('\n');

const INSPECTOR_SCRIPT = '<script id="__forge_inspector__">' + INSPECTOR_JS + '<' + '/script>';

function injectInspector(html: string): string {
  const meta = '<meta name="referrer" content="no-referrer">';
  const base = '<base target="_self">';
  let out = html;

  // Add meta + base tag
  if (out.includes('<head>')) {
    out = out.replace('<head>', '<head>' + meta + base);
  } else if (out.includes('<html>')) {
    out = out.replace('<html>', '<html><head>' + meta + base + '</head>');
  } else {
    out = meta + base + out;
  }

  // Inject inspector script as FIRST script so it registers click handlers before anything else
  if (out.includes('</head>')) return out.replace('</head>', INSPECTOR_SCRIPT + '</head>');
  if (out.includes('<body')) return out.replace('<body', INSPECTOR_SCRIPT + '<body');
  return INSPECTOR_SCRIPT + out;
}

// Sanitize generated HTML: kill ALL navigation escape hatches
function sanitizeHTML(html: string): string {
  let out = html;
  // Remove any <base href="..."> the AI might have added (messes up URL resolution)
  out = out.replace(/<base\s+href\s*=\s*["'][^"']*["'][^>]*>/gi, '');
  // CORE FIX: Replace ANY href that isn't safe with javascript:void(0) but preserve the original intent
  // Safe = starts with: # (anchor), https://, http://, javascript:, mailto:, tel:, {{
  // Everything else (like /pricing, ./page, about.html, etc.) gets nuked
  out = out.replace(
    /href\s*=\s*["'](?!#|https?:\/\/|javascript:|mailto:|tel:|\{\{)([^"']*)["']/gi,
    'data-forge-href="$1" href="javascript:void(0)"'
  );
  // Remove target attributes that escape the iframe
  out = out.replace(/target\s*=\s*["']_top["']/gi, 'target="_self"');
  out = out.replace(/target\s*=\s*["']_parent["']/gi, 'target="_self"');
  // Neutralize JS-based navigation
  out = out.replace(/window\.top\.location/g, 'void(0)');
  out = out.replace(/window\.parent\.location/g, 'void(0)');
  return out;
}

function EmptyState() {
  return (
    <div className="preview-empty">
      <div className="preview-empty-bg" />
      <div className="preview-empty-inner">
        <div style={{
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(12,12,12,0.8)',
          border: 'none',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(16px)',
          marginBottom: '24px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: 'rgba(17,17,17,0.9)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ display: 'flex', gap: '5px' }}>
              {['#FF5F57','#FEBC2E','#28C840'].map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />
              ))}
            </div>
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '999px',
              height: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.2)',
              fontFamily: 'monospace',
              gap: '6px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', opacity: 0.5 }} />
              forge.app / your-tool
            </div>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[100, 75, 60, 85, 45].map((w, i) => (
              <div key={i} style={{
                height: '12px',
                borderRadius: '6px',
                background: 'linear-gradient(90deg, #111 25%, #222 50%, #111 75%)',
                backgroundSize: '200% 100%',
                width: w + '%',
                animation: 'skeleton-sweep 1.8s ease-in-out ' + (i * 0.12) + 's infinite',
              }} />
            ))}
          </div>
        </div>
        <p>Describe a tool to build it</p>
        <span>Your app appears here, live, as it&apos;s generated</span>
      </div>
    </div>
  );
}

export default function PreviewFrame({ html, isStreaming, inspectMode, onElementClick, mode }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!html || isStreaming) return;
    const safe = sanitizeHTML(html);
    const patched = injectInspector(safe);
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Force full reload by clearing and re-setting srcdoc
    iframe.removeAttribute('srcdoc');
    requestAnimationFrame(() => { iframe.srcdoc = patched; });
  }, [html, isStreaming]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { __forge: inspectMode ? 'inspect_on' : 'inspect_off' }, '*'
    );
  }, [inspectMode]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.__forge_click) onElementClick(e.data.__forge_click);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onElementClick]);

  if (!html && !isStreaming) return <EmptyState />;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', padding: '14px', boxSizing: 'border-box' }}>
      <div className="preview-browser-chrome">
        <div className="preview-browser-bar">
          <div className="preview-browser-dots">
            <div className="preview-browser-dot" />
            <div className="preview-browser-dot" />
            <div className="preview-browser-dot" />
          </div>
          <div className="preview-browser-url">
            <div className="preview-browser-url-dot" />
            {isStreaming ? (mode === 'enhance' ? 'Enhancing…' : mode === 'plan' ? 'Planning…' : 'Building…') : 'forge.app / preview'}
          </div>
        </div>
        <div className="preview-browser-content">
          {isStreaming && (
            <div className="stream-overlay">
              <div className="stream-indicator">
                <span className="generating-dots"><span/><span/><span/></span>
                <span>{mode === 'enhance' ? 'Enhancing your app…' : mode === 'plan' ? 'Designing your blueprint…' : 'Crafting your app…'}</span>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="FORGE Preview"
            sandbox="allow-scripts allow-same-origin allow-modals allow-popups-to-escape-sandbox"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              background: 'transparent',
              opacity: isStreaming ? 0.2 : 1,
              transition: 'opacity 0.4s ease',
            } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}
