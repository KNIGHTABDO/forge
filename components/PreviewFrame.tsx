'use client';

import { useEffect, useRef } from 'react';

interface Props {
  html: string;
  isStreaming: boolean;
  inspectMode: boolean;
  onElementClick: (ref: string) => void;
}

/**
 * Inspector script injected into every generated tool.
 * Hover → highlight box + floating label tag.
 * Click → postMessage to parent with element description.
 */
const INSPECTOR_SCRIPT = `<script id="__forge_inspector__">(function(){
  var mode=false, overlay=null, label=null;

  function mkOverlay(){
    overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;top:0;left:0;pointer-events:none;z-index:2147483646;display:none;box-sizing:border-box;transition:top 0.08s,left 0.08s,width 0.08s,height 0.08s';
    document.body.appendChild(overlay);

    label=document.createElement('div');
    label.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;display:none;background:#3b82f6;color:#fff;font-family:system-ui,monospace;font-size:11px;font-weight:600;padding:2px 7px;border-radius:4px;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.4);letter-spacing:0.01em;transition:top 0.08s,left 0.08s';
    document.body.appendChild(label);
  }

  function highlight(el){
    if(!el||el===document.body||el===document.documentElement)return;
    var r=el.getBoundingClientRect();
    // Outer glow ring
    overlay.style.cssText='position:fixed;pointer-events:none;z-index:2147483646;box-shadow:inset 0 0 0 2px #3b82f6,0 0 0 9999px rgba(0,0,0,0.18);border-radius:4px;display:block;top:'+r.top+'px;left:'+r.left+'px;width:'+r.width+'px;height:'+r.height+'px;transition:top 0.08s,left 0.08s,width 0.08s,height 0.08s';

    // Label chip
    var tag=el.tagName.toLowerCase();
    var text=(el.textContent||el.value||el.placeholder||'').trim().slice(0,24);
    var chip=tag+(text?' \''+text+'\'':'');
    label.textContent=chip;

    // Position label above element, clamp to viewport
    var lh=20, lw=Math.min(chip.length*7+14, 200);
    var top=r.top-lh-4;
    if(top<4) top=r.bottom+4;
    var left=r.left;
    if(left+lw>window.innerWidth-8) left=window.innerWidth-lw-8;
    if(left<4) left=4;
    label.style.top=top+'px';
    label.style.left=left+'px';
    label.style.display='block';
  }

  function clear(){
    if(overlay) overlay.style.display='none';
    if(label) label.style.display='none';
  }

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
      e.preventDefault();e.stopPropagation();
      clear();
      window.parent.postMessage({__forge_click:describe(e.target)},'*');
    },true);
  });
}());<\/script>`;

function injectInspector(html: string): string {
  if (html.includes('</head>')) return html.replace('</head>', INSPECTOR_SCRIPT + '</head>');
  if (html.includes('<body')) return html.replace('<body', INSPECTOR_SCRIPT + '<body');
  return INSPECTOR_SCRIPT + html;
}

export default function PreviewFrame({ html, isStreaming, inspectMode, onElementClick }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Write HTML directly via srcdoc — avoids blob URL entirely.
  // srcdoc + allow-same-origin is safe: the iframe gets a null origin
  // (not the parent origin), so there's no XSS risk, but iOS Safari
  // correctly dispatches touch events into the frame.
  useEffect(() => {
    if (!html || isStreaming) return;
    const patched = injectInspector(html);
    const iframe = iframeRef.current;
    if (!iframe) return;
    // Reset then set so srcdoc change always triggers a reload
    iframe.removeAttribute('srcdoc');
    // Use requestAnimationFrame to ensure DOM flush before setting
    requestAnimationFrame(() => {
      iframe.srcdoc = patched;
    });
  }, [html, isStreaming]);

  // Toggle inspect mode inside the iframe
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { __forge: inspectMode ? 'inspect_on' : 'inspect_off' }, '*'
    );
  }, [inspectMode]);

  // Handle click-to-edit messages from inspector
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.__forge_click) onElementClick(e.data.__forge_click);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onElementClick]);

  if (!html && !isStreaming) {
    return (
      <div className="preview-empty">
        <div className="empty-icon">⚒</div>
        <p>Describe a tool to build it</p>
        <span>Your app appears here, live, as it&apos;s generated</span>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {isStreaming && (
        <div className="stream-overlay">
          <div className="stream-indicator">
            <span className="generating-dots"><span/><span/><span/></span>
            <span>Building your tool...</span>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="FORGE Preview"
        // allow-same-origin is REQUIRED for iOS Safari touch events to work
        // inside iframes. srcdoc frames get a null origin (not parent origin),
        // so this is safe — parent JS cannot reach iframe DOM via same-origin.
        sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-pointer-lock allow-same-origin"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
          background: '#0a0a0a',
          opacity: isStreaming ? 0.25 : 1,
          transition: 'opacity 0.3s',
          touchAction: 'manipulation',
        } as React.CSSProperties}
      />
    </div>
  );
}
