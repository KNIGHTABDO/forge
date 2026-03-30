'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import '../home.css';
import '../legal.css';

export default function ChangelogPage() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const documentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
    const initialTheme: 'light' | 'dark' = (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : (documentTheme === 'light' || documentTheme === 'dark') ? documentTheme : 'light';
    
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    const handleThemeChange = () => {
      const newTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null;
      setTheme(newTheme || 'light');
    };
    
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    
    setMounted(true);
    return () => observer.disconnect();
  }, []);

  const isActive = (path: string) => pathname === path;

  if (!mounted) return null;

  const updates = [
    {
      version: 'v3.1',
      date: 'March 2026',
      title: 'Deep Research Agent (Beta)',
      description: 'Forge now ships a fully dedicated conversational Deep Research workflow, separate from the build experience. It delivers transparent long-form analysis with live thinking updates, source-level visibility, and citable report synthesis.',
      items: [
        'Standalone route: /research/[id] with shareable, session-backed state',
        'Full-screen chat-first interface with centered-to-docked composer transition',
        'Premium animated thinking feed with live phase, stats, and ETA tracking',
        'Website-by-website analysis feed with favicon/domain/status visibility',
        'Inline editable research plan with approve workflow in conversation',
        'Pause / Resume / Stop controls for long-running research cycles',
        'Inline-cited final reports with source appendix',
        'Markdown export + print-to-PDF export path',
        'No coupling to /build app-creation flow (strict isolation)'
      ]
    },
    {
      version: 'v3.0',
      date: 'March 2026',
      title: 'Unified React Orchestration (V3 Launch)',
      description: 'A major structural overhaul. We’ve removed the complexity of "Modes" (Plan, Build, Fast) in favor of a unified conversational builder. Forge now intelligently decides when to chat and when to implement your ideas, building modular React projects in real-time.',
      items: [
        'Unified Orchestrator (Conversation and Code in one workflow)',
        'Delta-Sync: Incremental multi-file project architecture',
        'Automatic Background Session Saving & Restore via GitHub',
        '📦 Sandpack V3 Engine: Hot-reloading React environment',
        'Native State-Based Multi-Page Routing',
        'Atomic Git-Tree Deployments for multi-file projects',
        'Legacy V1 HTML Compatibility Proxy'
      ]
    },
    {
      version: 'v2.5',
      date: 'March 2026',
      title: 'Stitch AI & Design Context',
      description: 'Integrated Google Stitch AI to generate high-fidelity UI mockups as visual references for the builder engine.',
      items: [
        'Visual design reference system',
        'Improved visual coherence in layout generation',
        'Tailwind CSS dynamic injection layer'
      ]
    },
    {
      version: 'v2.0',
      date: 'Feb 2026',
      title: 'Data Persistence (BaaS)',
      description: 'Introduction of the Forge BaaS protocol for cloud-synced application data.',
      items: [
        'Integration of window.forge.db',
        'GitHub-backed JSON persistence',
        'Cross-session data loading'
      ]
    },
    {
      version: 'v1.0',
      date: 'Jan 2026',
      title: 'Project Genesis',
      description: 'The birth of the FORGE protocol for single-file HTML/CSS applications.',
      items: [
        'One-shot application generation',
        'Instant live preview',
        'Basic deployment engine'
      ]
    }
  ];

  return (
    <div className="legal-page">
      <nav className="nav">
        <Link href="/" className="nav-logo">FORGE</Link>
        <div className="nav-links">
          <Link href="/#how" className="nav-link">How it works</Link>
          <Link href="/#gallery" className="nav-link">Gallery</Link>
          <Link href="/research/new" className="nav-link">Deep Research</Link>
          <Link href="/pricing" className="nav-link">Pricing</Link>
        </div>
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <ThemeToggle />
          <Link href="/build" className="nav-cta">Start Forging</Link>
        </div>
      </nav>

      <section className="legal-hero">
        <span className="legal-eyebrow">Evolution / Protocol</span>
        <h1 className="legal-title"><>Change<br />Log</></h1>
        <p className="legal-subtitle">
          Tracing the history of the FORGE protocol as it reaches its ultimate conversational form in V3. 
        </p>
        <p className="legal-meta">Current Protocol Status: Operational v3.1 (Deep Research Agent Beta)</p>
      </section>

      <div className="legal-body">
        <aside className="legal-toc">
          <p className="legal-toc-title">Timeline</p>
          <ul className="legal-toc-list">
            {updates.map((up) => (
              <li key={up.version}>
                <a href={`#${up.version}`}>{up.date} — {up.version}</a>
              </li>
            ))}
          </ul>
        </aside>

        <main className="legal-content">
          {updates.map((up, i) => (
            <div className="legal-section" id={up.version} key={up.version}>
              <span className="legal-section-num">{up.version}</span>
              <div className="legal-meta" style={{ marginBottom: '8px' }}>{up.date}</div>
              <h2 className="legal-section-title">{up.title}</h2>
              <p>{up.description}</p>
              <ul>
                {up.items.map((item, ii) => (
                  <li key={ii}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </main>
      </div>

      <footer className="footer">
        <p className="footer-copy">© 2026 FORGE DIGITAL. ALL RIGHTS RESERVED.</p>
        <div className="footer-links">
          <Link href="/privacy" className="footer-link">Privacy</Link>
          <Link href="/terms" className="footer-link">Terms</Link>
          <Link href="/changelog" className="footer-link">Changelog</Link>
          <a href="https://twitter.com/jip7e" target="_blank" rel="noopener noreferrer" className="footer-link">Twitter / X</a>
        </div>
      </footer>
    </div>
  );
}
