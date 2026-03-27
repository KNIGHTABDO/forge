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
      version: 'v2.5',
      date: 'March 2026',
      title: 'Flash Navigation & Preview Hardening',
      description: 'A major reliability update focused on interactive stability and smart generation. We introduced a multi-layered sandbox to prevent preview frames from breaking out and a robust "Flash Navigation" system for real-time app expansion.',
      items: [
        'Flash Navigation (Turbo-All) for real-time section generation',
        'Multi-layered iframe sandboxing and HTML sanitization',
        'Smart Title system with two-tier fallback (Gemini → Claude 4.5)',
        'Enhanced text selection branding (Premium gold/violet selection)',
        'Blocked navigation interception with one-click resolution'
      ]
    },
    {
      version: 'v2.4',
      date: 'March 2026',
      title: 'Enhance Mode (Beta)',
      description: 'The most anticipated update: multi-page generation. FORGE can now reason about complex application structures and generate multiple linked files simultaneously using GitHub Models integration.',
      items: [
        'Multi-file generation capabilities',
        'Automatic routing between generated pages',
        'Shared state management across views',
        'Beta badge implementation for early testing'
      ]
    },
    {
      version: 'v2.3',
      date: 'March 2026',
      title: 'Stitch Design AI',
      description: 'Integrated Google Stitch AI to generate high-fidelity UI mockups. Users can now generate design variations and use them as instant visual anchors for the Forge builder.',
      items: [
        'Google Stitch AI (MCP) integration',
        'Visual design reference system',
        'Asynchronous mockup generation',
        'Improved visual coherence in layouts'
      ]
    },
    {
      version: 'v2.2',
      date: 'March 2026',
      title: 'Admin Protocol & Chat Mode',
      description: 'Introduced a secure administrative interface and a conversational "Chat Mode" for architectural brainstorming before entering the planning phase.',
      items: [
        'Secure password-protected Admin page',
        'Session and project management tools',
        'Conversational AI for early-stage ideation',
        'Strict refusal mechanism for off-topic requests'
      ]
    },
    {
      version: 'v2.1',
      date: 'March 2026',
      title: 'Multi-Agent Evolution',
      description: 'Divided the generation process into specialized roles: The Architect (Plan) and The Builder (Execution). This ensures high-fidelity results and predictable implementation.',
      items: [
        'Separate Planning and Building phases',
        'Interactive Technical Blueprints',
        'Real-time thinking cards with progress steps',
        'Deterministic execution logic'
      ]
    },
    {
      version: 'v2.0',
      date: 'March 2026',
      title: 'Forge BaaS (Persistence)',
      description: 'Turned static demos into real apps with persistent data storage. Every tool built by FORGE now has access to a cloud-synced database layer.',
      items: [
        'Integration of window.forge.db',
        'GitHub-backed JSON persistence',
        'Cross-session data loading',
        'Session state checkpoints and restoration'
      ]
    },
    {
      version: 'v1.0',
      date: 'Feb 2026',
      title: 'Project Genesis',
      description: 'The birth of the FORGE protocol. A minimalist editor capable of turning a single sentence into a Tailwind-styled HTML application instantly.',
      items: [
        'One-shot HTML/CSS generation',
        'Instant live preview',
        'Basic deployment engine',
        'Warm cream editorial design system'
      ]
    }
  ];

  return (
    <div className="legal-page">
      {/* Navigation */}
      <nav className="nav">
        <Link href="/" className="nav-logo">FORGE</Link>
        <div className="nav-links">
          <Link href="/#how" className="nav-link">How it works</Link>
          <Link href="/#gallery" className="nav-link">Gallery</Link>
          <Link href="/pricing" className="nav-link">Pricing</Link>
        </div>
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <ThemeToggle />
          <Link href="/build" className="nav-cta">Start Forging</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="legal-hero">
        <span className="legal-eyebrow">Evolution / Protocol</span>
        <h1 className="legal-title"><>Change<br />Log</></h1>
        <p className="legal-subtitle">
          Tracing the history of the FORGE protocol from its first spark to the current multi-agent revolution.
        </p>
        <p className="legal-meta">Protocol Status: Operational v2.5 (Flash Nav)</p>
      </section>

      {/* Body */}
      <div className="legal-body">
        {/* Table of Contents */}
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

        {/* Content */}
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

      {/* Footer */}
      <footer className="footer" style={{ borderTop: '1px solid var(--border)', padding: '48px' }}>
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
