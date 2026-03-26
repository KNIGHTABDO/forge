'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import type { GalleryEntry } from '@/lib/github';
import './home.css';

// Light video is the default for SSR
const LIGHT_VIDEO = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/forge-promo-light-fzsAp3fDNiMsZzPANvEfFnZAx0o7Sp.mp4';
const DARK_VIDEO = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/forge-promo-2uvaCuwY7ICqXFSLctTSVIYQDIpxJC.mp4';

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

// Interactive Demo - Light themed to match page
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
  const [hasError, setHasError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const toolUrl = `/api/preview/${tool.slug}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setLoaded(true); observer.disconnect(); } },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleIframeError = () => setHasError(true);

  return (
    <Link href={`/tool/${tool.slug}`} className="exhibit-card">
      <div ref={ref} className="exhibit-preview">
        {loaded && !hasError ? (
          <iframe 
            ref={iframeRef}
            src={toolUrl} 
            title={tool.title || tool.slug} 
            loading="lazy" 
            sandbox="allow-scripts allow-same-origin"
            onError={handleIframeError}
          />
        ) : hasError ? (
          <div className="exhibit-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M9 21V9"/>
            </svg>
          </div>
        ) : (
          <div className="exhibit-skeleton" />
        )}
      </div>
      <div className="exhibit-info">
        <h4 className="exhibit-name">{tool.title || tool.slug.replace(/-/g, ' ')}</h4>
        <p className="exhibit-protocol">Protocol {String(index + 1).padStart(2, '0')}</p>
      </div>
    </Link>
  );
}

export default function Home() {
  const [tools, setTools] = useState<GalleryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'kinetic' | 'liquid'>('light');
  const [displayLimit, setDisplayLimit] = useState(4);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  // Always render light video URL initially to avoid hydration mismatch
  // Will be updated dynamically after mount
  const videoUrl = LIGHT_VIDEO;

  const startNewSession = () => {
    localStorage.removeItem('forge-session-id');
    router.push('/build');
  };

  useEffect(() => {
    // Initialize theme from localStorage or document, default to light
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'kinetic' | 'liquid' | null;
    const documentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | 'kinetic' | 'liquid' | null;
    const initialTheme = savedTheme || documentTheme || 'light';
    
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    localStorage.setItem('theme', initialTheme);
    
    // Update video src after hydration to match theme
    // Both dark, kinetic, and liquid themes use the dark video
    const newVideoUrl = initialTheme === 'light' ? LIGHT_VIDEO : DARK_VIDEO;
    if (videoElementRef.current && videoElementRef.current.src !== newVideoUrl) {
      videoElementRef.current.src = newVideoUrl;
    }
    
    // Watch for theme changes from toggle button
    const handleThemeChange = () => {
      const newTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | 'kinetic' | 'liquid' | null;
      const updatedTheme = newTheme || 'light';
      setTheme(updatedTheme);
      
      const newVideoUrl = updatedTheme === 'light' ? LIGHT_VIDEO : DARK_VIDEO;
      if (videoElementRef.current && videoElementRef.current.src !== newVideoUrl) {
        videoElementRef.current.src = newVideoUrl;
        videoElementRef.current.play().catch(() => {}); // Resume playback if paused
      }
    };
    
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    
    setMounted(true);
    
    fetch('/api/gallery')
      .then(r => r.json())
      .then(data => { setTools(data); setLoading(false); })
      .catch(() => setLoading(false));
    
    return () => observer.disconnect();
  }, []);

  const filteredTools = tools.filter(t => 
    (t.title || t.slug).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`page ${theme === 'kinetic' ? 'theme-kinetic' : ''}`}>
      {/* Navigation */}
      <nav className="nav">
        <Link href="/" className="nav-logo">{theme === 'kinetic' ? 'Forge' : 'FORGE'}</Link>
        <div className="nav-links">
          <a href="#how" className="nav-link">How it works</a>
          <a href="#gallery" className="nav-link">Gallery</a>
          <Link href="/changelog" className="nav-link">Changelog</Link>
          <Link href="/pricing" className="nav-link">Pricing</Link>
        </div>
        <div className="nav-right">
          <button className="nav-search" onClick={() => { setShowSearch(!showSearch); document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' }); }}>Search</button>
          <ThemeToggle />
          <button onClick={startNewSession} className="nav-cta">Inquire</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={`hero ${theme === 'kinetic' ? 'hero-kinetic' : ''}`}>
        {theme === 'kinetic' && (
          <div className="eternal-arc-container">
            <div className="eternal-arc-ambient" />
            <div className="eternal-arc-ring" />
            <div className="eternal-arc-glow" />
          </div>
        )}
        {theme === 'liquid' && (
          <div className="liquid-orb-container">
            <div className="liquid-orb liquid-orb-1" />
            <div className="liquid-orb liquid-orb-2" />
            <div className="liquid-orb liquid-orb-3" />
          </div>
        )}
        
        <div className={`hero-content ${mounted ? 'visible' : ''} ${theme === 'kinetic' ? 'hero-content-kinetic' : ''}`}>
          <span className="hero-eyebrow">
            {theme === 'kinetic' ? 'The Kinetic Archive' : theme === 'liquid' ? 'Liquid Glass / Protocol' : 'Autonomous Creation / Protocol'}
          </span>
          <h1 className="hero-title">
            {theme === 'kinetic' ? (
              <>
                BUILD<br />
                APPS<br />
                WITH ONE<br />
                SENTENCE.
              </>
            ) : (
              <>
                BUILD<br />
                APPS<br />
                <span className="hero-title-outline">WITH ONE</span><br />
                SENTENCE.
              </>
            )}
          </h1>
          <p className="hero-desc">
            Describe your idea. Get a fully working interactive web app instantly. No code required. No limits.
          </p>
          <div className="hero-actions">
            <button onClick={startNewSession} className="btn-primary">Start Forging</button>
            <a href="#gallery" className="btn-ghost">
              Explore Gallery
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
        
        <div className={`hero-visual ${mounted ? 'visible' : ''} ${theme === 'kinetic' ? 'hero-visual-kinetic' : ''}`}>
          <video 
            ref={videoElementRef}
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800'%3E%3Crect fill='%23000' width='1200' height='800'/%3E%3C/svg%3E"
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="hero-number">001</div>
        </div>
      </section>

      {/* Marquee brand bar — liquid theme only */}
      {theme === 'liquid' && (
        <div className="liquid-marquee-bar">
          <div className="marquee-track">
            {[
              'Liquid Glass', 'Zero Code', 'AI Powered', 'Ship Instantly',
              'Full Stack', 'One Sentence', 'Production Ready', 'Any Idea',
              'Liquid Glass', 'Zero Code', 'AI Powered', 'Ship Instantly',
              'Full Stack', 'One Sentence', 'Production Ready', 'Any Idea',
            ].map((item, i) => (
              <span key={i} className="marquee-item">{item}</span>
            ))}
          </div>
        </div>
      )}

      {/* How it Works */}
      <section className="how" id="how">
        <span className="section-eyebrow">Workflow</span>
        <h2 className="section-title">How it works</h2>
        <p className="section-desc">Three steps from idea to deployed app.</p>
        
        <div className="steps">
          <div className="step">
            <span className="step-num">01</span>
            <h3 className="step-title">Describe</h3>
            <p className="step-desc">Tell us what you want in plain English. A sentence is all it takes.</p>
            <svg className="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </div>
          
          <div className="step">
            <span className="step-num">02</span>
            <h3 className="step-title">Generate</h3>
            <p className="step-desc">Our AI builds your complete app in seconds. Preview it instantly.</p>
            <svg className="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <path d="M9 9h6M9 12h6M9 15h4"/>
            </svg>
          </div>
          
          <div className="step">
            <span className="step-num">03</span>
            <h3 className="step-title">Ship</h3>
            <p className="step-desc">Deploy with one click. Share your unique URL with the world.</p>
            <svg className="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 12l5 5L20 7"/>
            </svg>
          </div>
        </div>
      </section>
      
      {/* Advanced Evolution Section */}
      <section className="how" style={{ borderTop: 'none', background: 'var(--bg-alt)' }}>
        <span className="section-eyebrow">Advanced Evolution</span>
        <h2 className="section-title">Superior Aesthetics & Multi-Page Scale</h2>
        <p className="section-desc">Forge doesn't just build snippets. It engineers complete experiences.</p>
        
        <div className="steps-2-col">
          <div className="step">
            <span className="step-num">AI</span>
            <h3 className="step-title">Stitch Design AI</h3>
            <p className="step-desc">Describe your design and let Google Stitch AI generate high-fidelity UI mockups instantly. Use these designs as precise visual anchors for your Forge builds.</p>
            <svg className="step-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          
          <div className="step">
            <span className="step-num">∞</span>
            <h3 className="step-title">Enhance Mode (Beta)</h3>
            <p className="step-desc">Break the single-page barrier. Scale your ideas into full-fledged multi-page applications with automated routing and shared state, powered by GitHub Models.</p>
            <svg className="step-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <path d="M7 18.5v-13M17 18.5v-13M12 12l5-3M12 12l-5-3M12 12v9"/>
            </svg>
          </div>

          <div className="step">
            <span className="step-num">G</span>
            <h3 className="step-title">Gemini API Dev Skill</h3>
            <p className="step-desc">Forge's Architect and Builder agents carry Google's official gemini-api-dev skill — embedding authoritative knowledge of the latest Gemini 3 models, current SDKs, and best-practice patterns directly into every generation.</p>
            <svg className="step-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4l3 3"/>
            </svg>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="demo-section">
        <InteractiveDemo />
      </section>

      {/* Exhibition / Gallery */}
      <section className="exhibition" id="gallery">
        <div className="exhibition-header">
          <div>
            <span className="section-eyebrow">Exhibition</span>
            <h2 className="exhibition-title">Built Apps</h2>
            <p className="exhibition-desc">Recent creations from the Forge protocol.</p>
          </div>
          <button className="view-all" onClick={() => setShowSearch(!showSearch)}>
            {showSearch ? 'Hide Search' : 'Search Apps'}
          </button>
        </div>

        {showSearch && (
          <div className="search-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search apps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')}>Clear</button>
            )}
          </div>
        )}
        
        {loading ? (
          <div className="exhibit-loading">
            <div className="demo-spinner" />
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="exhibit-empty">
            {search ? (
              <p>No apps match "{search}"</p>
            ) : (
              <>
                <p>No apps yet. Be the first to create something.</p>
                <button onClick={startNewSession} className="btn-primary">Create First App</button>
              </>
            )}
          </div>
        ) : (
          <div className="exhibit-grid">
            {filteredTools.slice(0, displayLimit).map((t, i) => <ToolCard key={t.slug} tool={t} index={i} />)}
          </div>
        )}

        {filteredTools.length > 4 && !loading && (
          <div className="gallery-actions">
            <button 
              className={`btn-show-more ${displayLimit > 4 ? 'active' : ''}`}
              onClick={() => setDisplayLimit(displayLimit > 4 ? 4 : filteredTools.length)}
            >
              <span>{displayLimit > 4 ? 'Show Less' : 'Show More'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
              </svg>
            </button>
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="cta">
        <h2 className="cta-title">Ready to build?</h2>
        <p className="cta-desc">Turn your ideas into working apps in seconds.</p>
        <button onClick={startNewSession} className="cta-button">Start Forging</button>
        <p className="cta-tagline">FORGE: Build anything. Ship instantly.</p>
        <div className="cta-watermark">FORGE</div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p className="footer-copy">© 2026 FORGE DIGITAL. ALL RIGHTS RESERVED.</p>
        <div className="footer-links">
          <Link href="/privacy" className="footer-link">Privacy</Link>
          <Link href="/terms" className="footer-link">Terms</Link>
          <Link href="/contact" className="footer-link">Contact</Link>
          <a href="https://twitter.com/jip7e" target="_blank" rel="noopener noreferrer" className="footer-link">Twitter / X</a>
        </div>
      </footer>
    </div>
  );
}
