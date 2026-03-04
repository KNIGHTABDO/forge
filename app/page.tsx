'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { GalleryEntry } from '@/lib/github';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// Lazy iframe — only loads when the card scrolls into viewport
function LazyIframe({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setLoaded(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="tool-card-preview">
      {loaded ? (
        <iframe
          src={src}
          title={title}
          scrolling="no"
          tabIndex={-1}
          sandbox="allow-scripts allow-same-origin"
          className="tool-card-iframe"
        />
      ) : (
        <div className="tool-card-skeleton" />
      )}
      <div className="tool-card-preview-overlay" />
    </div>
  );
}

function ToolCard({ tool }: { tool: GalleryEntry }) {
  const toolUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/t/${tool.slug}`;
  return (
    <div className="tool-card">
      <LazyIframe src={toolUrl} title={tool.title || tool.slug} />
      <div className="tool-card-body">
        <div className="tool-card-meta">
          <span className="tool-card-slug">/t/{tool.slug}</span>
          <span className="tool-card-time">{timeAgo(tool.updated ?? tool.created)}</span>
        </div>
        <h3 className="tool-card-title">{tool.title || tool.slug}</h3>
        {tool.description && <p className="tool-card-desc">{tool.description}</p>}
        <div className="tool-card-actions">
          <a href={toolUrl} target="_blank" rel="noopener" className="tool-card-btn open">Open ↗</a>
          <Link href={`/build?tool=${tool.slug}`} className="tool-card-btn edit">Edit</Link>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [tools, setTools] = useState<GalleryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gallery')
      .then(r => r.json())
      .then(data => { setTools(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return tools;
    const q = query.toLowerCase();
    return tools.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  }, [tools, query]);

  return (
    <main className="home">
      <nav className="home-nav">
        <span className="home-nav-logo">⚒ FORGE</span>
        <Link href="/build" className="home-nav-cta">Build a tool →</Link>
      </nav>

      <section className="home-hero">
        <h1 className="home-hero-title">Describe a tool.<br/>Get a working app.</h1>
        <p className="home-hero-sub">Type one sentence. FORGE generates a fully interactive web app, instantly.</p>
        <Link href="/build" className="home-hero-btn">Start Building →</Link>
      </section>

      <section className="home-gallery">
        <div className="gallery-header">
          <div className="gallery-heading-group">
            <h2 className="gallery-heading">Previously built</h2>
            {!loading && tools.length > 0 && (
              <span className="gallery-count">{tools.length} tool{tools.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="gallery-search-wrap">
            <span className="gallery-search-icon">⌕</span>
            <input
              className="gallery-search"
              type="search"
              placeholder="Search tools..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              spellCheck={false}
            />
            {query && (
              <button className="gallery-search-clear" onClick={() => setQuery('')} aria-label="Clear">✕</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="gallery-loading">
            <span className="gen-dot"/><span className="gen-dot"/><span className="gen-dot"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="gallery-empty">
            {query ? `No tools matching "${query}"` : 'No tools built yet — be the first!'}
          </div>
        ) : (
          <div className="gallery-grid">
            {filtered.map(t => <ToolCard key={t.slug} tool={t} />)}
          </div>
        )}
      </section>
    </main>
  );
}
