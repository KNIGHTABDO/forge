'use client';

import { SandpackProvider, SandpackPreview } from '@codesandbox/sandpack-react';
import { useEffect, useMemo, useState } from 'react';

export interface ProjectFile {
  path: string;
  content: string;
}

interface Props {
  files: ProjectFile[];
  isStreaming: boolean;
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

function EmptyState() {
  return (
    <div className="preview-empty">
      <div className="preview-empty-bg" />
      <div className="preview-empty-inner">
        <div className="preview-browser-chrome" style={{ position: 'relative', inset: 'auto', width: '100%', maxWidth: '480px' }}>
          <div className="preview-browser-bar">
            <div className="preview-browser-dots">
              <div className="preview-browser-dot" /><div className="preview-browser-dot" /><div className="preview-browser-dot" />
            </div>
            <div className="preview-browser-url">
              <div className="preview-browser-url-dot" />forge.app / your-tool
            </div>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-surface)' }}>
            {[100, 75, 60, 85, 45].map((w, i) => (
              <div key={i} style={{ height: '12px', borderRadius: '6px', background: 'var(--bg-overlay)', width: `${w}%` }} />
            ))}
          </div>
        </div>
        <p>Describe a tool to build it</p>
        <span>Your app appears here, live, as it&apos;s generated</span>
      </div>
    </div>
  );
}

function SandpackWrapper({ sandpackFiles }: { sandpackFiles: Record<string, string> }) {
  const [cryptoReady, setCryptoReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.crypto && !window.crypto.subtle) {
        try {
          Object.defineProperty(window.crypto, 'subtle', {
            configurable: true,
            get: () => ({
              digest: async (_alg: string) => {
                const arr = new Uint8Array(32);
                window.crypto.getRandomValues(arr);
                return arr.buffer;
              },
            }),
          });
        } catch { /* already defined or immutable */ }
      }
      setCryptoReady(true);
    }
  }, []);

  if (!cryptoReady) return null;

  return (
    <SandpackProvider
      template="react"
      files={sandpackFiles}
      customSetup={{
        // Only lucide-react — recharts is 2MB+ and frequently crashes the bundler worker
        dependencies: {
          'lucide-react': 'latest',
        },
      }}
      options={{
        autorun: true,
        recompileMode: 'delayed',
        recompileDelay: 500,
      }}
    >
      <SandpackPreview
        showOpenInCodeSandbox={false}
        showRefreshButton={true}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </SandpackProvider>
  );
}

export default function PreviewFrame({ files, isStreaming }: Props) {
  const sandpackFiles = useMemo(() => {
    const obj: Record<string, string> = {};

    for (const file of files) {
      let p = file.path.startsWith('/') ? file.path : `/${file.path}`;

      // Skip package.json — managed via customSetup
      if (p === '/package.json') continue;

      // Skip index.html — Sandpack CRA bundler ignores /public/index.html overrides
      if (p === '/public/index.html' || p === '/index.html') continue;

      // Map App.jsx → App.js (CRA template entry is .js)
      if (p === '/App.jsx' || p === '/app.jsx') p = '/App.js';
      p = p.replace(/\.jsx$/, '.js');

      obj[p] = file.content;
    }

    // Always override index.js to inject Tailwind CDN before React renders
    obj['/index.js'] = INDEX_JS;

    return obj;
  }, [files]);

  const hasFiles = files && files.length > 0;

  if (!hasFiles && !isStreaming) {
    return <EmptyState />;
  }

  return (
    <div className="preview-browser-chrome">
      <div className="preview-browser-bar">
        <div className="preview-browser-dots">
          <div className="preview-browser-dot" /><div className="preview-browser-dot" /><div className="preview-browser-dot" />
        </div>
        <div className="preview-browser-url">
          <div className="preview-browser-url-dot" />
          {isStreaming ? 'Building Component Tree…' : 'forge.app / preview'}
        </div>
      </div>

      <div className="preview-browser-content">
        {isStreaming && (
          <div className="stream-overlay">
            <div className="stream-indicator">
              <span className="generating-dots"><span /><span /><span /></span>
              <span>Writing Code…</span>
            </div>
          </div>
        )}

        <div style={{ width: '100%', height: '100%', opacity: isStreaming ? 0 : 1 }}>
          {!isStreaming && hasFiles && (
            <SandpackWrapper sandpackFiles={sandpackFiles} />
          )}
        </div>
      </div>
    </div>
  );
}
