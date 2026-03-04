'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Props {
  html: string;
  isStreaming: boolean;
  inspectMode: boolean;
  onElementClick: (ref: string) => void;
}

/**
 * Inspector script injected into every generated tool.
 * Listens for postMessage to toggle highlight-on-hover + click-to-describe.
 */
const INSPECTOR_SCRIPT = `<script id="__forge_inspector__">(function(){
  var mode=false,overlay=null;
  function mkOverlay(){
    overlay=document.createElement('div');
    overlay.style.cssText='position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;display:none;box-sizing:border-box;transition:all 0.1s';
    document.body.appendChild(overlay);
  }
  function highlight(el){
    if(!el||el===document.body||el===document.documentElement)return;
    var r=el.getBoundingClientRect();
    overlay.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;box-shadow:inset 0 0 0 2px #3b82f6,0 0 0 9999px rgba(59,130,246,0.06);border-radius:3px;display:block;top:'+r.top+'px;left:'+r.left+'px;width:'+r.width+'px;height:'+r.height+'px';
  }
  function clear(){if(overlay)overlay.style.display='none';}
  function describe(el){
    var tag=el.tagName.toLowerCase();
    var text=(el.textContent||el.value||el.placeholder||'').trim().slice(0,60);
    var label=el.getAttribute('aria-label')||el.getAttribute('placeholder')||'';
    var d='the <'+tag+'>';
    if(label)d+=' labeled "'+label+'"';
    else if(text)d+=' saying "'+text+'"';
    if(el.id)d+=' (#'+el.id+')';
    return d;
  }
  window.addEventListener('message',function(e){
    if(e.data&&e.data.__forge){
      mode=e.data.__forge==='inspect_on';
      if(!mode)clear();
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
      window.parent.postMessage({__forge_click:describe(e.target)},'*');
    },true);
  });
})();<\/script>`;

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
