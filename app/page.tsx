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

  useEffect(() => {
    if (phase !== 'building') return;
    const timeout = setTimeout(() => setPhase('complete'), 1500);
    return () => clearTimeout(timeout);
  }, [phase]);

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
        <div className={`demo-input ${phase !== 'typing' ? 'demo-input-done' : ''}`}>
          <span className="demo-cursor" style={{ opacity: phase === 'typing' ? 1 : 0 }} />
          <span className="demo-text">{typedText || 'Describe your app...'}</span>
          {phase === 'typing' && typedText.length === fullPrompt.length && (
            <span className="demo-enter">Press Enter</span>
          )}
        </div>

        {phase === 'building' && (
          <div className="demo-building">
            <div className="demo-spinner" />
            <span>Forging your app...</span>
          </div>
        )}

        {phase === 'complete' && (
          <div className="demo-app">
            <div className="demo-app-header">Pomodoro Timer</div>
            <div className="demo-timer-display">{formatTime(timerValue)}</div>
            <div className="demo-timer-progress">
              <div className="demo-timer-bar" style={{ width: `${(timerValue / (25 * 60)) * 100}%` }} />
            </div>
            <div className="demo-timer-controls">
              <button className="demo-btn demo-btn-primary" onClick={() => setIsRunning(!isRunning)}>
                {isRunning ? 'Pause' : 'Start'}
              </button>
              <button className="demo-btn" onClick={resetTimer}>Reset</button>
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
    <Link href={`/tool/${tool.slug}`} className="gallery-card" style={{ '--delay': `${index * 0.05}s` } as React.CSSProperties}>
      <div ref={ref} className="gallery-card-preview">
        {loaded ? (
          <iframe src={toolUrl} title={tool.title || tool.slug} loading="lazy" sandbox="allow-scripts allow-same-origin" />
        ) : (
          <div className="gallery-card-skeleton" />
        )}
        <div className="gallery-card-overlay">
          <span className="gallery-card-view">View Project</span>
        </div>
      </div>
      <div className="gallery-card-info">
        <h4 className="gallery-card-title">{tool.title || tool.slug}</h4>
        <p className="gallery-card-protocol">Protocol {String(index + 1).padStart(2, '0')}.{Math.floor(Math.random() * 9)}</p>
      </div>
    </Link>
  );
}

export default function Home() {
  const [tools, setTools] = useState<GalleryEntry[]>([]);
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

  return (
    <div className="page">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-container">
          <Link href="/" className="nav-logo">FORGE</Link>
          <div className="nav-links">
            <a href="#how" className="nav-link">How it works</a>
            <a href="#gallery" className="nav-link nav-link-active">Gallery</a>
          </div>
          <div className="nav-actions">
            <button className="nav-search">Search</button>
            <button onClick={startNewSession} className="nav-cta">Inquire</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className={`hero-content ${mounted ? 'visible' : ''}`}>
            <span className="hero-eyebrow">Autonomous Creation / Protocol</span>
            <h1 className="hero-title">
              BUILD APPS<br />
              <span className="hero-title-stroke">WITH ONE</span><br />
              SENTENCE.
            </h1>
            <p className="hero-desc">
              Describe your idea. Get a fully working interactive web app instantly. No code required. No limits.
            </p>
            <div className="hero-actions">
              <button onClick={startNewSession} className="btn-primary">Start Forging</button>
              <a href="#gallery" className="btn-secondary">
                <span>Explore Gallery</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M4 1L10 7L4 13" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </a>
            </div>
          </div>
          
          <div className={`hero-visual ${mounted ? 'visible' : ''}`}>
            <div className="hero-image-wrap">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDySEgToMEsKdqcZzkxKwlZgPJqFJLZXQ0vONLVkj6MuPA_UZ3CbQbq_wCq9mBA3ceAzUsJ8W5CziPYS_lI_263dAZV74zrK2_C_uQXU3GP2dQsWxd6md3P7s9ly16I9ueX5IsxKHdiK3JjIi8UnCiPG15mP9g1pFYNQqqQbYo2DL7AjJj6s0dYKxlcxDf6JQrv0eTikI4nP0lMWeMlCdpYvFhoEoVvs3uvxLvpsXy-VnouDomro6DR082eOhCZtPJ_LoOvHzraCAbs" 
                alt="Abstract AI sculpture" 
                className="hero-image"
              />
              <div className="hero-image-halftone" />
              <div className="hero-image-number">001</div>
            </div>
          </div>
        </div>
        <div className="hero-side-text">FORGE DIGITAL PROTOCOL © 2024</div>
      </section>

      {/* How it Works */}
      <section className="how" id="how">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Workflow</span>
            <h2 className="section-title">How it works</h2>
            <p className="section-desc">Three steps from idea to deployed app.</p>
          </div>
          
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-content">
                <span className="step-number">01</span>
                <div className="step-info">
                  <h3 className="step-title">Describe</h3>
                  <p className="step-desc">Tell us what you want in plain English. A sentence is all it takes.</p>
                </div>
              </div>
              <div className="step-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
              </div>
            </div>
            
            <div className="step-card">
              <div className="step-content">
                <span className="step-number">02</span>
                <div className="step-info">
                  <h3 className="step-title">Generate</h3>
                  <p className="step-desc">Our AI builds your complete app in seconds. Preview it instantly.</p>
                </div>
              </div>
              <div className="step-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                  <path d="M9 9h6M9 12h6M9 15h4"/>
                </svg>
              </div>
            </div>
            
            <div className="step-card">
              <div className="step-content">
                <span className="step-number">03</span>
                <div className="step-info">
                  <h3 className="step-title">Ship</h3>
                  <p className="step-desc">Deploy with one click. Share your unique URL with the world.</p>
                </div>
              </div>
              <div className="step-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 12l5 5L20 7"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="demo-section">
        <div className="section-container">
          <div className="demo-wrapper">
            <InteractiveDemo />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="gallery" id="gallery">
        <div className="section-container">
          <div className="gallery-header">
            <div className="section-header">
              <span className="section-eyebrow">Exhibition</span>
              <h2 className="section-title">Built Apps</h2>
              <p className="section-desc">Recent creations from the Forge protocol.</p>
            </div>
            <a href="#gallery" className="gallery-view-all">View all work</a>
          </div>
          
          {loading ? (
            <div className="gallery-loading">
              <div className="spinner" />
            </div>
          ) : tools.length === 0 ? (
            <div className="gallery-empty">
              <p>No apps yet. Be the first to create something.</p>
              <button onClick={startNewSession} className="btn-primary">Create First App</button>
            </div>
          ) : (
            <div className="gallery-grid">
              {tools.slice(0, 4).map((t, i) => <ToolCard key={t.slug} tool={t} index={i} />)}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="cta">
        <div className="cta-container">
          <h2 className="cta-title">Ready to build?</h2>
          <div className="cta-content">
            <p className="cta-desc">Turn your ideas into working apps in seconds.</p>
            <button onClick={startNewSession} className="btn-primary btn-lg">Start Forging</button>
            <p className="cta-tagline">FORGE: Build anything. Ship instantly.</p>
          </div>
        </div>
        <div className="cta-bg-text">FORGE</div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <p className="footer-copyright">© 2024 FORGE DIGITAL. ALL RIGHTS RESERVED.</p>
          <div className="footer-links">
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
            <a href="#" className="footer-link">Twitter / X</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
