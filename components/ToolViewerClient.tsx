'use client';

import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';
import { useMemo, useState, useEffect } from 'react';

interface ProjectFile {
  path: string;
  content: string;
}

// Custom entry that injects Tailwind CDN before the React app mounts
const INDEX_JS = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Inject Tailwind CSS from CDN
if (!document.querySelector('#tw-cdn')) {
  const s = document.createElement('script');
  s.id = 'tw-cdn';
  s.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(s);
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(App));
`;

export default function ToolViewerClient({ 
  files, 
  withBanner = false, 
  title = 'App', 
  slug = ''
}: { 
  files: ProjectFile[], 
  withBanner?: boolean, 
  title?: string, 
  slug?: string
}) {
  const [copied, setCopied] = useState(false);
  const [cryptoReady, setCryptoReady] = useState(false);

  // Polyfill crypto.subtle for Sandpack in non-secure contexts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.crypto && !window.crypto.subtle) {
        try {
          Object.defineProperty(window.crypto, 'subtle', {
            configurable: true,
            get: () => ({
              digest: async () => new Uint8Array(32).buffer,
            }),
          });
        } catch { /* immutable */ }
      }
      setCryptoReady(true);
    }
  }, []);

  // Determine if this is a React project or legacy HTML
  const isReact = useMemo(() => {
    const prefix = `tools/${slug}/`;
    return files.some(f => {
      const p = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path;
      return p.match(/App\.(js|jsx|tsx)$/i);
    });
  }, [files, slug]);

  const sandpackFiles = useMemo(() => {
    if (!isReact) return {}; // Handled by iframe fallback

    const obj: Record<string, string> = {};
    const prefix = `tools/${slug}/`;

    for (const file of files) {
      let p = file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path;
      if (!p.startsWith('/')) p = `/${p}`;
      if (p === '/App.jsx' || p === '/app.jsx') p = '/App.js';
      p = p.replace(/\.jsx$/, '.js');
      if (p === '/package.json' || p === '/index.js' || p === '/index.html' || p === '/forge.json') continue;
      obj[p] = file.content;
    }

    obj['/index.js'] = INDEX_JS;
    return obj;
  }, [files, slug, isReact]);

  // Legacy HTML extraction
  const legacyHTML = useMemo(() => {
    if (isReact) return null;
    const prefix = `tools/${slug}/`;
    const htmlFile = files.find(f => {
      const p = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path;
      return p === '/index.html' || p === 'index.html' || p === '/public/index.html' || p === 'public/index.html';
    });
    return htmlFile?.content || null;
  }, [files, slug, isReact]);

  const handleCopy = async () => {
    const url = window.location.href;
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(url);
      else throw new Error();
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!cryptoReady) return null;

  return (
    <div className="tool-viewer-root" style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column' }}>
      
      {withBanner && (
        <div className="tool-viewer-banner" style={{
          height: '48px',
          background: 'rgba(13,13,16,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <a href="/" style={{ textDecoration: 'none', color: '#fff', fontWeight: 'bold', fontSize: '14px', letterSpacing: '0.05em' }}>FORGE</a>
             <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
             <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{title}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleCopy}
              style={{
                background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', 
                padding: '5px 12px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
            <a href={`/build?tool=${slug}`}
              style={{
                background: '#fff', color: '#000', textDecoration: 'none', borderRadius: '6px', 
                padding: '5px 12px', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s'
              }}
            >
              Remix
            </a>
          </div>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
         {isReact ? (
            <SandpackProvider 
                template="react" 
                theme="dark"
                files={sandpackFiles}
                customSetup={{ 
                  dependencies: {
                    "lucide-react": "latest",
                    "recharts": "latest"
                  }
                }}
                options={{
                  autorun: true,
                  classes: {
                    "sp-wrapper": "h-full w-full",
                    "sp-layout": "h-full w-full !border-none !rounded-none !bg-transparent",
                    "sp-preview": "h-full w-full",
                    "sp-preview-iframe": "h-full w-full border-none",
                  }
                }}
              >
                <SandpackPreview 
                  showOpenInCodeSandbox={false}
                  showRefreshButton={false} 
                  style={{ height: '100%', width: '100%', border: 'none' }}
                />
                <style dangerouslySetInnerHTML={{ __html: `
                  .sp-overlay, .sp-loading, .sp-cube-wrapper { display: none !important; }
                  .sp-wrapper, .sp-layout, .sp-stack { height: 100% !important; border: none !important; }
                `}} />
            </SandpackProvider>
         ) : (
            <iframe 
              srcDoc={legacyHTML || '<h1>Project not found</h1>'} 
              style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
              title={title}
            />
         )}
      </div>
    </div>
  );
}
