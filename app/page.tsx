'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GalleryEntry } from '@/lib/github';
import './home.css';

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

// Interactive Demo Component with real working prototype
function InteractiveDemo() {
  const [phase, setPhase] = useState<'typing' | 'building' | 'complete'>('typing');
  const [typedText, setTypedText] = useState('');
  const [timerValue, setTimerValue] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const fullPrompt = 'Build me a pomodoro timer';
  
  // Typing animation
  useEffect(() => {
    if (phase !== 'typing') return;
    if (typedText.length < fullPrompt.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullPrompt.slice(0, typedText.length + 1));
      }, 80);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => setPhase('building'), 800);
      return () => clearTimeout(timeout);
    }
  }, [typedText, phase]);

  // Building animation
  useEffect(() => {
    if (phase !== 'building') return;
    const timeout = setTimeout(() => setPhase('complete'), 1500);
    return () => clearTimeout(timeout);
  }, [phase]);

  // Timer logic when complete
  useEffect(() => {
    if (phase !== 'complete' || !isRunning) return;
    const interval = setInterval(() => {
      setTimerValue(v => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, isRunning]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTimer = () => {
    setTimerValue(25 * 60);
    setIsRunning(false);
  };

  return (
    <div className="demo-browser">
      <div className="demo-bar">
        <div className="demo-dots">
          <span /><span /><span />
        </div>
        <div className="demo-url">forge.app/build</div>
      </div>
      <div className="demo-content">
        {/* Prompt Input */}
        <div className={`demo-input ${phase !== 'typing' ? 'demo-input-done' : ''}`}>
          <span className="demo-cursor" style={{ opacity: phase === 'typing' ? 1 : 0 }} />
          <span className="demo-text">{typedText || 'Describe your app...'}</span>
          {phase === 'typing' && typedText.length === fullPrompt.length && (
            <span className="demo-enter">Press Enter</span>
          )}
        </div>

        {/* Building State */}
        {phase === 'building' && (
          <div className="demo-building">
            <div className="demo-spinner" />
            <span>Forging your app...</span>
          </div>
        )}

        {/* Complete - Working Pomodoro Timer */}
        {phase === 'complete' && (
          <div className="demo-app">
            <div className="demo-app-header">Pomodoro Timer</div>
            <div className="demo-timer-display">{formatTime(timerValue)}</div>
            <div className="demo-timer-progress">
              <div 
                className="demo-timer-bar" 
                style={{ width: `${(timerValue / (25 * 60)) * 100}%` }} 
              />
            </div>
            <div className="demo-timer-controls">
              <button 
                className="demo-btn demo-btn-primary"
                onClick={() => setIsRunning(!isRunning)}
              >
                {isRunning ? 'Pause' : 'Start'}
              </button>
              <button className="demo-btn" onClick={resetTimer}>
                Reset
              </button>
            </div>
            <div className="demo-app-badge">Built with FORGE</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCard({ tool, index }: { tool: GalleryEntry; index: number }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const toolUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/t/${tool.slug}`;

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
    <Link 
      href={`/tool/${tool.slug}`} 
      className="card" 
      style={{ '--delay': `${index * 0.05}s` } as React.CSSProperties}
    >
      <div ref={ref} className="card-preview">
        {loaded ? (
          <iframe
            src={toolUrl}
            title={tool.title || tool.slug}
            loading="lazy"
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className="card-skeleton" />
        )}
        <div className="card-overlay">
          <span>View App</span>
        </div>
      </div>
      <div className="card-body">
        <h3 className="card-title">{tool.title || tool.slug}</h3>
        <p className="card-desc">{tool.description}</p>
        <div className="card-footer">
          <div className="card-tags">
            {tool.tags?.slice(0, 2).map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
          <span className="card-time">{timeAgo(tool.updated ?? tool.created)}</span>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const [tools, setTools] = useState<GalleryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  const startNewSession = () => {
    localStorage.removeItem('forge-session-id');
    router.push('/build');
  };

  useEffect(() => {
    setMounted(true);
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
    <div className="page">
      {/* Subtle gradient background */}
      <div className="bg-gradient" />
      
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="logo">FORGE</Link>
          <div className="nav-links">
            <a href="#how" className="nav-link">How it works</a>
            <a href="#gallery" className="nav-link">Gallery</a>
          </div>
          <button onClick={startNewSession} className="nav-cta">
            Start Building
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7H11M11 7L7 3M11 7L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className={`hero-content ${mounted ? 'visible' : ''}`}>
<h1 className="hero-title">
            Build apps with
            <br />
            <span className="hero-highlight">one sentence</span>
          </h1>
          
          <p className="hero-sub">
            Describe your idea. Get a fully working interactive web app instantly.
            <br />
            No code required. No limits.
          </p>

          <div className="hero-actions">
            <button onClick={startNewSession} className="btn-primary">
              Start Forging
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M13 8L8 3M13 8L8 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <a href="#gallery" className="btn-ghost">
              Explore Gallery
            </a>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">{tools.length || '—'}</span>
              <span className="stat-label">Apps built</span>
            </div>
            <div className="stat-sep" />
            <div className="stat">
              <span className="stat-value">{'<'}10s</span>
              <span className="stat-label">Generation time</span>
            </div>
            <div className="stat-sep" />
            <div className="stat">
              <span className="stat-value">Free</span>
              <span className="stat-label">Forever</span>
            </div>
          </div>
        </div>

        {/* Interactive Demo */}
        <div className={`hero-demo ${mounted ? 'visible' : ''}`}>
          <InteractiveDemo />
        </div>
      </section>

      {/* How it works */}
      <section className="how" id="how">
        <div className="section-head">
          <h2 className="section-title">How it works</h2>
          <p className="section-sub">Three steps from idea to deployed app</p>
        </div>
        
        <div className="steps">
          <div className="step">
            <div className="step-num">01</div>
            <h3 className="step-title">Describe</h3>
            <p className="step-desc">
              Tell us what you want in plain English. A sentence is all it takes.
            </p>
          </div>
          <div className="step">
            <div className="step-num">02</div>
            <h3 className="step-title">Generate</h3>
            <p className="step-desc">
              Our AI builds your complete app in seconds. Preview it instantly.
            </p>
          </div>
          <div className="step">
            <div className="step-num">03</div>
            <h3 className="step-title">Ship</h3>
            <p className="step-desc">
              Deploy with one click. Share your unique URL with the world.
            </p>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="gallery" id="gallery">
        <div className="section-head">
          <div className="gallery-title-row">
            <h2 className="section-title">Gallery</h2>
            {!loading && tools.length > 0 && (
              <span className="gallery-count">{tools.length}</span>
            )}
          </div>
          <p className="section-sub">Explore what others have built</p>
        </div>

        <div className="search-wrap">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="search"
            className="search-input"
            placeholder="Search apps..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <div className="gallery-loading">
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="gallery-empty">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="8" y="12" width="32" height="24" rx="3"/>
                <path d="M8 18h32"/>
                <circle cx="14" cy="15" r="1.5" fill="currentColor" stroke="none"/>
                <circle cx="19" cy="15" r="1.5" fill="currentColor" stroke="none"/>
              </svg>
            </div>
            <h3 className="empty-title">
              {query ? `No results for "${query}"` : 'No apps yet'}
            </h3>
            <p className="empty-desc">
              {query ? 'Try a different search term' : 'Be the first to create something'}
            </p>
            {!query && (
              <button onClick={startNewSession} className="btn-primary">
                Create First App
              </button>
            )}
          </div>
        ) : (
          <div className="cards">
            {filtered.map((t, i) => <ToolCard key={t.slug} tool={t} index={i} />)}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="cta">
        <h2 className="cta-title">Ready to build?</h2>
        <p className="cta-sub">Turn your ideas into working apps in seconds</p>
        <button onClick={startNewSession} className="btn-primary btn-lg">
          Start Forging
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 9H14M14 9L9 4M14 9L9 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <span className="footer-logo">FORGE</span>
        <span className="footer-text">Build anything. Ship instantly.</span>
      </footer>
    </div>
  );
}
