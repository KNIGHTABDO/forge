'use client';

import { useEffect, useRef } from 'react';

interface Props {
  html: string;
  isStreaming: boolean;
  inspectMode: boolean;
  onElementClick: (ref: string) => void;
}

const INSPECTOR_SCRIPT = `<script id="__forge_inspector__">(function(){
  var mode=false, overlay=null, label=null;
  function mkOverlay(){
    overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;top:0;left:0;pointer-events:none;z-index:2147483646;display:none;box-sizing:border-box;transition:top 0.08s,left 0.08s,width 0.08s,height 0.08s';
    document.body.appendChild(overlay);
    label=document.createElement('div');
    label.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;display:none;background:#fff;color:#000;font-family:system-ui,monospace;font-size:11px;font-weight:600;padding:3px 8px;border-radius:6px;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 12px rgba(0,0,0,0.5);letter-spacing:0.01em;transition:top 0.08s,left 0.08s';
    document.body.appendChild(label);
  }
  function highlight(el){
    if(!el||el===document.body||el===document.documentElement)return;
    var r=el.getBoundingClientRect();
    overlay.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;box-shadow:inset 0 0 0 2px #fff,0 0 0 9999px rgba(0,0,0,0.4);border-radius:8px;display:block;top:'+r.top+'px;left:'+r.left+'px;width:'+r.width+'px;height:'+r.height+'px;transition:top 0.08s,left 0.08s,width 0.08s,height 0.08s';
    var tag=el.tagName.toLowerCase();
    var text=(el.textContent||el.value||el.placeholder||'').trim().slice(0,24);
    var chip=tag+(text?' "'+text+'"':'');
    label.textContent=chip;
    var lh=20,lw=Math.min(chip.length*7+14,200);
    var top=r.top-lh-4;
    if(top<4) top=r.bottom+4;
    var left=r.left;
    if(left+lw>window.innerWidth-8) left=window.innerWidth-lw-8;
    if(left<4) left=4;
    label.style.top=top+'px';label.style.left=left+'px';label.style.display='block';
  }
  function clear(){ if(overlay) overlay.style.display='none'; if(label) label.style.display='none'; }
  function describe(el){
    var tag=el.tagName.toLowerCase();
    var text=(el.textContent||el.value||el.placeholder||'').trim().slice(0,60);
    var lbl=el.getAttribute('aria-label')||el.getAttribute('placeholder')||'';
    var d='the <'+tag+'>';
    if(lbl) d+=' labeled "'+lbl+'"';
    else if(text) d+=' saying "'+text+'"';
    if(el.id) d+=' (#'+el.id+')';
    return d;
  }
  window.addEventListener('message',function(e){
    if(e.data&&e.data.__forge){
      mode=e.data.__forge==='inspect_on';
      if(!mode) clear();
      document.body.style.cursor=mode?'crosshair':'';
    }
  });
  document.addEventListener('DOMContentLoaded',function(){
    mkOverlay();
    document.addEventListener('mouseover',function(e){if(mode)highlight(e.target);},true);
    document.addEventListener('mouseout',function(){if(mode)clear();},true);
    document.addEventListener('click',function(e){
      if(!mode)return;
      e.preventDefault();e.stopPropagation();clear();
      window.parent.postMessage({__forge_click:describe(e.target)},'*');
    },true);
  });
}());<\/script>`;

function injectInspector(html: string): string {
  if (html.includes('</head>')) return html.replace('</head>', INSPECTOR_SCRIPT + '</head>');
  if (html.includes('<body')) return html.replace('<body', INSPECTOR_SCRIPT + '<body');
  return INSPECTOR_SCRIPT + html;
}

function EmptyState() {
  return (
    <div className="preview-empty">
      <div className="preview-empty-bg" />
      <div className="preview-empty-inner">
        {/* Animated browser mockup skeleton */}
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
          {/* Browser chrome bar */}
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
          {/* Skeleton content */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[100, 75, 60, 85, 45].map((w, i) => (
              <div key={i} style={{
                height: '12px',
                borderRadius: '6px',
                background: 'linear-gradient(90deg, #111 25%, #222 50%, #111 75%)',
                backgroundSize: '200% 100%',
                width: `${w}%`,
                animation: `skeleton-sweep 1.8s ease-in-out ${i * 0.12}s infinite`,
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

export default function PreviewFrame({ html, isStreaming, inspectMode, onElementClick }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!html || isStreaming) return;
    const patched = injectInspector(html);
    const iframe = iframeRef.current;
    if (!iframe) return;
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
      {/* Browser chrome wrapper */}
      <div className="preview-browser-chrome">
        <div className="preview-browser-bar">
          <div className="preview-browser-dots">
            <div className="preview-browser-dot" />
            <div className="preview-browser-dot" />
            <div className="preview-browser-dot" />
          </div>
          <div className="preview-browser-url">
            <div className="preview-browser-url-dot" />
            {isStreaming ? 'Building…' : 'forge.app / preview'}
          </div>
        </div>
        <div className="preview-browser-content">
          {isStreaming && (
            <div className="stream-overlay">
              <div className="stream-indicator">
                <span className="generating-dots"><span/><span/><span/></span>
                <span>Crafting your app…</span>
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="FORGE Preview"
            sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-pointer-lock allow-same-origin"
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
