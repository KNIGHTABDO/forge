'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Props {
  html: string;
  isStreaming: boolean;
  inspectMode: boolean;
  onElementClick: (ref: string) => void;
}

const INSPECTOR_SCRIPT = `<script id="__forge_inspector__">(function(){var mode=false,hovered=null,overlay=null;function createOverlay(){overlay=document.createElement('div');overlay.style.cssText='position:fixed;top:0;left:0;pointer-events:none;z-index:2147483647;display:none;box-sizing:border-box';document.body.appendChild(overlay);}function highlight(el){if(!el||el===document.body||el===document.documentElement)return;var r=el.getBoundingClientRect();overlay.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;box-shadow:inset 0 0 0 2px #3b82f6;border-radius:3px;display:block;top:'+r.top+'px;left:'+r.left+'px;width:'+r.width+'px;height:'+r.height+'px';}function clearHighlight(){if(overlay)overlay.style.display='none';}function describeEl(el){var tag=el.tagName.toLowerCase();var text=(el.textContent||el.value||el.placeholder||'').trim().slice(0,60);var label=el.getAttribute('aria-label')||el.getAttribute('placeholder')||'';var desc='the <'+tag+'>';if(label)desc+=' labeled "'+label+'"';else if(text)desc+=' saying "'+text+'"';if(el.id)desc+=' (#'+el.id+')';return desc;}window.addEventListener('message',function(e){if(e.data&&e.data.__forge){mode=e.data.__forge==='inspect_on';if(!mode)clearHighlight();document.body.style.cursor=mode?'crosshair':'';}});document.addEventListener('DOMContentLoaded',function(){createOverlay();document.addEventListener('mouseover',function(e){if(!mode)return;hovered=e.target;highlight(hovered);},true);document.addEventListener('mouseout',function(){if(!mode)return;clearHighlight();},true);document.addEventListener('click',function(e){if(!mode)return;e.preventDefault();e.stopPropagation();window.parent.postMessage({__forge_click:describeEl(e.target)},'*');},true);});})();<\/script>`;

export default function PreviewFrame({ html, isStreaming, inspectMode, onElementClick }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const buildBlobUrl = useCallback((rawHtml: string): string => {
    const patched = rawHtml.includes('</head>')
      ? rawHtml.replace('</head>', INSPECTOR_SCRIPT + '</head>')
      : INSPECTOR_SCRIPT + rawHtml;
    const blob = new Blob([patched], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, []);

  // Only update iframe when streaming is done
  useEffect(() => {
    if (!html || isStreaming) return;
    const newUrl = buildBlobUrl(html);
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = newUrl;
    if (iframeRef.current) iframeRef.current.src = newUrl;
  }, [html, isStreaming, buildBlobUrl]);

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

  useEffect(() => {
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, []);

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
        // Note: allow-same-origin intentionally OMITTED — blob URLs + same-origin
        // creates a shared origin context that breaks localStorage isolation.
        // Scripts run fine without it; localStorage works correctly inside the tool.
        sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-pointer-lock"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '0',
          background: '#0a0a0a',
          cursor: inspectMode ? 'crosshair' : 'default',
          opacity: isStreaming ? 0.3 : 1,
          transition: 'opacity 0.3s',
          // Enable touch scrolling inside iframe on iOS
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}
      />
    </div>
  );
}
