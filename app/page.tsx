'use client';

import { addTransitionType, startTransition, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import type { GalleryEntry } from '@/lib/github';
import './home.css';

// Light video is the default for SSR
const LIGHT_VIDEO = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/forge-promo-light-fzsAp3fDNiMsZzPANvEfFnZAx0o7Sp.mp4';
const DARK_VIDEO = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/forge-promo-2uvaCuwY7ICqXFSLctTSVIYQDIpxJC.mp4';

// Interactive Demo
function InteractiveDemo() {
  const [phase, setPhase] = useState<'typing' | 'building' | 'naming' | 'complete'>('typing');
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
    const timeout = setTimeout(() => setPhase('naming'), 1500);
    return () => clearTimeout(timeout);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'naming') return;
    const timeout = setTimeout(() => setPhase('complete'), 1200);
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

        {phase === 'naming' && (
          <div className="demo-building">
            <div className="demo-spinner" />
            <span>✨ Naming your project...</span>
          </div>
        )}

        {phase === 'complete' && (
          <div className="demo-app">
            <div className="demo-app-title-badge">⭐ FocusPulse</div>
            <div className="demo-app-header">FocusPulse</div>
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
  const toolUrl = `/preview/${tool.slug}`;

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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [displayLimit, setDisplayLimit] = useState(4);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  // Always render light video URL initially to avoid hydration mismatch
  const videoUrl = LIGHT_VIDEO;

  const navigateWithTransition = (href: string, direction: 'nav-forward' | 'nav-back' = 'nav-forward') => {
    startTransition(() => {
      addTransitionType(direction);
      router.push(href);
    });
  };

  const startNewSession = () => {
    localStorage.removeItem('forge-session-id');
    navigateWithTransition('/build', 'nav-forward');
  };

  const startDeepResearch = () => {
    navigateWithTransition('/research/new', 'nav-forward');
  };

  useEffect(() => {
    // Initialize theme from localStorage or document, default to light
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const documentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
    const initialTheme: 'light' | 'dark' =
      (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme :
      (documentTheme === 'light' || documentTheme === 'dark') ? documentTheme : 'light';
    
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    localStorage.setItem('theme', initialTheme);
    
    // Update video src after hydration to match theme
    const newVideoUrl = initialTheme === 'light' ? LIGHT_VIDEO : DARK_VIDEO;
    if (videoElementRef.current && videoElementRef.current.src !== newVideoUrl) {
      videoElementRef.current.src = newVideoUrl;
    }
    
    // Watch for theme changes from toggle button
    const handleThemeChange = () => {
      const newTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
      const updatedTheme: 'light' | 'dark' = (newTheme === 'light' || newTheme === 'dark') ? newTheme : 'light';
      setTheme(updatedTheme);
      
      const newVideoUrl = updatedTheme === 'light' ? LIGHT_VIDEO : DARK_VIDEO;
      if (videoElementRef.current && videoElementRef.current.src !== newVideoUrl) {
        videoElementRef.current.src = newVideoUrl;
        videoElementRef.current.play().catch(() => {});
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
  const desktopReleaseUrl = 'https://github.com/KNIGHTABDO/forge/releases/latest';

  return (
    <div className="page">
      {/* Navigation */}
      <nav className="nav">
        <Link href="/" className="nav-logo forge-wordmark">FORGE</Link>
        <div className="nav-links">
          <a href="#how" className="nav-link">How it works</a>
          <a href="#gallery" className="nav-link">Gallery</a>
          <Link href="/research/new" className="nav-link">Deep Research</Link>
          <Link href="/changelog" className="nav-link">Changelog</Link>
          <Link href="/pricing" className="nav-link">Pricing</Link>
          <a href="#desktop" className="nav-link">Desktop</a>
          <a href="#desktop-account" className="nav-link">Account</a>
        </div>
        <div className="nav-right">
          <button className="nav-search" onClick={() => { setShowSearch(!showSearch); document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' }); }}>Search</button>
          <ThemeToggle />
          <button onClick={startNewSession} className="nav-cta">Inquire</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className={`hero-content ${mounted ? 'visible' : ''}`}>
          <Link href="/research/new" className="hero-announcement">
            <span className="hero-announcement-badge">New</span>
            <span className="hero-announcement-text">Introducing Deep Research Agent (Beta)</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <span className="hero-eyebrow">Autonomous Creation / Protocol</span>
          <h1 className="hero-title">
            BUILD<br />
            APPS<br />
            <span className="hero-title-outline">WITH ONE</span><br />
            SENTENCE.
          </h1>
          <p className="hero-desc">
            Describe your idea. Get a fully working interactive web app instantly. No code required. No limits.
          </p>
          <div className="hero-actions">
            <button onClick={startNewSession} className="btn-primary">Start Forging</button>
            <button onClick={startDeepResearch} className="btn-ghost">Deep Research (Beta)</button>
            <a href="#gallery" className="btn-ghost">
              Explore Gallery
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
        
        <div className={`hero-visual ${mounted ? 'visible' : ''}`}>
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

      {/* How it Works */}
      <section className="how" id="how">
        <span className="section-eyebrow">Workflow</span>
        <h2 className="section-title">How it works</h2>
        <p className="section-desc">Choose instant app generation or a fully dedicated deep research run.</p>
        
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

      <section className="research-preview">
        <div className="research-preview-header">
          <span className="section-eyebrow">New Protocol</span>
          <h2 className="section-title">Deep Research Agent (Beta)</h2>
          <p className="section-desc">A standalone conversational research route with live thinking updates, source transparency, and citable long-form reports.</p>
        </div>

        <div className="research-preview-grid">
          <div className="research-preview-card">
            <h3>Conversation-first flow</h3>
            <p>Start with a focused prompt, then watch the composer dock into a live chat-style research feed.</p>
          </div>
          <div className="research-preview-card">
            <h3>Live deep analysis</h3>
            <p>Track query generation, domain-by-domain analysis, learned insights, and evolving depth metrics in real time.</p>
          </div>
          <div className="research-preview-card">
            <h3>Structured cited reports</h3>
            <p>Get sectioned synthesis with inline citations, source appendix, markdown export, PDF export, and follow-up turns.</p>
          </div>
        </div>

        <div className="research-preview-actions">
          <button onClick={startDeepResearch} className="btn-primary">Launch Deep Research (Beta)</button>
          <p className="research-preview-note">Completely separate from the build workflow at /build.</p>
        </div>
      </section>
      
      {/* Advanced Evolution Section */}
      <section className="how" style={{ borderTop: 'none', background: 'var(--bg-alt)' }}>
        <span className="section-eyebrow">Advanced Evolution</span>
        <h2 className="section-title">Headless React & Unified Orchestration</h2>
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
            <h3 className="step-title">Unified Orchestration</h3>
            <p className="step-desc">No more modes. Our V3 Orchestrator handles conversation and implementation in a single workflow. Build complex, multi-file React apps with modular components and state-based routing instantly.</p>
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

          <div className="step">
            <span className="step-num">✦</span>
            <h3 className="step-title">Automated Smart Branding</h3>
            <p className="step-desc">Our V3 engine automatically analyzes your project's intent and generates a short, professional, and brandable name instantly. This title is automatically applied as the project's permanent identity across your private build session and the public gallery.</p>
            <svg className="step-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>

          <div className="step">
            <span className="step-num">β</span>
            <h3 className="step-title">Deep Research Agent</h3>
            <p className="step-desc">Run a dedicated long-form research agent in a full conversational interface with animated thinking, inline plan editing, live source tracking, and citable synthesis.</p>
            <svg className="step-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 3v18M3 12h18"/>
              <circle cx="12" cy="12" r="8"/>
            </svg>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section className="demo-section">
        <InteractiveDemo />
      </section>

      {/* Desktop Section */}
      <section className="desktop-section" id="desktop">
        <div className="desktop-content">
          <span className="section-eyebrow">Native / Windows First</span>
          <h2 className="section-title">Forge Desktop App</h2>
          <p className="section-desc">Forge is now desktop-first. Build with a polished native interface, rich model controls, authenticated sync, and transparent tool execution built for serious workflows.</p>

          <div className="desktop-visual-grid">
            <article className="desktop-card">
              <h3>Thinking Stream</h3>
              <p>Structured reasoning timeline cards designed for long-running workflows and transparent decision flow.</p>
            </article>
            <article className="desktop-card">
              <h3>Tool Call Surface</h3>
              <p>Real-time status rows for file operations, orchestration hooks, and execution lifecycle visibility.</p>
            </article>
            <article className="desktop-card">
              <h3>Extension Dock</h3>
              <p>Toggle advanced capabilities per desktop profile while staying inside Forge-native styling and controls.</p>
            </article>
            <article className="desktop-card">
              <h3>Web Search Panel</h3>
              <p>Session-authenticated source discovery routed through the Forge backend.</p>
            </article>
          </div>

          <div className="desktop-download-row">
            <a
              className="desktop-download"
              href={desktopReleaseUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Latest Desktop Release
            </a>
            <p className="desktop-download-note">Releases are generated automatically from GitHub and always point to the latest installer assets.</p>
          </div>
        </div>
      </section>
      
      {/* Desktop Account Section */}
      <section className="desktop-account-section" id="desktop-account">
        <div className="desktop-account-content">
          <span className="section-eyebrow">Cloud / Device Sync</span>
          <h2 className="section-title">Desktop Account & Session Control</h2>
          <p className="section-desc">Sign in once, sync cloud keys securely, monitor device telemetry, and manage active sessions from a single desktop-focused control surface.</p>

          <div className="desktop-account-showcase">
            <article className="desktop-account-surface">
              <p className="desktop-account-kicker">Forge Desktop Control Surface</p>
              <h3>One login. One workspace. Full control.</h3>
              <div className="desktop-account-pill-row">
                <span className="desktop-status-pill online">Backend Connected</span>
                <span className="desktop-status-pill">Gemini Runtime</span>
                <span className="desktop-status-pill">Auto Release Feed</span>
              </div>

              <div className="desktop-account-steps">
                <div className="desktop-account-step">
                  <span className="desktop-account-step-num">01</span>
                  <div>
                    <h4>Browser Sign-In</h4>
                    <p>Secure callback flow at /desktop with instant session restoration inside the app.</p>
                  </div>
                </div>
                <div className="desktop-account-step">
                  <span className="desktop-account-step-num">02</span>
                  <div>
                    <h4>Cloud Key Hydration</h4>
                    <p>Model keys and runtime health sync from backend without local environment setup.</p>
                  </div>
                </div>
                <div className="desktop-account-step">
                  <span className="desktop-account-step-num">03</span>
                  <div>
                    <h4>Device Governance</h4>
                    <p>Track active devices, telemetry, and revoke stale sessions from a single dashboard.</p>
                  </div>
                </div>
              </div>
            </article>

            <aside className="desktop-account-rail">
              <h3>Release Delivery Rail</h3>
              <p>Each push runs web + desktop validation. Pushes to main/master automatically publish a new Forge Desktop release.</p>
              <a href={desktopReleaseUrl} target="_blank" rel="noopener noreferrer" className="desktop-release-link">
                Open Latest Desktop Release
              </a>
              <ul className="desktop-release-list">
                <li>GitHub Actions status is the source of truth for desktop builds.</li>
                <li>Release artifacts are attached to each published desktop release.</li>
              </ul>
            </aside>
          </div>

          <div className="desktop-account-features-grid">
            <div className="desktop-account-feature-card">
              <h3>Session Health</h3>
              <p>Diagnose runtime state, key readiness, and agent request IDs directly from the desktop account panel.</p>
            </div>
            <div className="desktop-account-feature-card">
              <h3>Model Governance</h3>
              <p>Control provider and model behavior from desktop while backend keeps execution safe and observable.</p>
            </div>
            <div className="desktop-account-feature-card">
              <h3>Release Confidence</h3>
              <p>Desktop packaging runs with every push and publishes installable artifacts from main/master automatically.</p>
            </div>
          </div>

          <div className="desktop-account-footer-links">
            <a href={desktopReleaseUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">Latest Desktop Release</a>
            <Link href="/changelog" className="btn-ghost">Read Desktop Changelog</Link>
            <Link href="/desktop" className="btn-ghost">Manage Desktop Settings</Link>
          </div>
        </div>
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
              <p>No apps match &quot;{search}&quot;</p>
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
        <div className="cta-actions">
          <button onClick={startNewSession} className="cta-button">Start Forging</button>
          <button onClick={startDeepResearch} className="btn-ghost cta-secondary">Deep Research (Beta)</button>
        </div>
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
