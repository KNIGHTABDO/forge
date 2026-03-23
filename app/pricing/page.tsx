'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import '@/app/home.css';

export default function PricingPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'kinetic'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'kinetic' | null;
    const documentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | 'kinetic' | null;
    const initialTheme = savedTheme || documentTheme || 'light';
    
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
    
    const handleThemeChange = () => {
      const newTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | 'kinetic' | null;
      setTheme(newTheme || 'light');
    };
    
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    
    setMounted(true);
    return () => observer.disconnect();
  }, []);

  if (!mounted) return null;

  return (
    <div className={`page ${theme === 'kinetic' ? 'theme-kinetic' : ''}`}>
      <nav className="nav">
        <Link href="/" className="nav-logo">{theme === 'kinetic' ? 'Forge' : 'FORGE'}</Link>
        <div className="nav-links">
          <Link href="/#how" className="nav-link">How it works</Link>
          <Link href="/#gallery" className="nav-link">Gallery</Link>
          <Link href="/changelog" className="nav-link">Changelog</Link>
          <Link href="/pricing" className="nav-link active">Pricing</Link>
        </div>
        <div className="nav-right">
          <ThemeToggle />
          <Link href="/build" className="nav-cta">Start Forging</Link>
        </div>
      </nav>

      <main className="pricing-container">
        {theme === 'kinetic' && (
          <div className="eternal-arc-container">
            <div className="eternal-arc-ambient" />
            <div className="eternal-arc-ring" style={{ width: '400px', height: '400px' }} />
          </div>
        )}

        <div className="pricing-content">
          <span className="section-eyebrow">Investment</span>
          <h1 className="section-title">Transparent pricing.</h1>
          <p className="section-desc">Forge is currently in early access. All features are free for now.</p>

          <div className="pricing-grid">
            <div className="pricing-card featured">
              <div className="card-header">
                <span className="plan-name">Founders Pass</span>
                <div className="plan-price">
                  <span className="currency">$</span>
                  <span className="amount">0</span>
                  <span className="period">/mo</span>
                </div>
              </div>
              <ul className="plan-features">
                <li>Unlimited App Generations</li>
                <li>Stitch Design AI Access</li>
                <li>Enhance Mode (Beta)</li>
                <li>Custom Domain Deployment</li>
                <li>Global Edge Network</li>
                <li>Priority 24/7 Support</li>
              </ul>
              <Link href="/build" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '32px' }}>
                Join Early Access
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="footer-copy">© 2026 FORGE DIGITAL. ALL RIGHTS RESERVED.</p>
        <div className="footer-links">
          <Link href="/privacy" className="footer-link">Privacy</Link>
          <Link href="/terms" className="footer-link">Terms</Link>
          <a href="https://twitter.com/jip7e" target="_blank" rel="noopener noreferrer" className="footer-link">Twitter / X</a>
        </div>
      </footer>

      <style jsx>{`
        .pricing-container {
          min-height: 100vh;
          padding-top: 120px;
          padding-bottom: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .pricing-content {
          max-width: 800px;
          width: 100%;
          padding: 0 48px;
          text-align: center;
          position: relative;
          z-index: 10;
        }
        .pricing-grid {
          margin-top: 64px;
          display: flex;
          justify-content: center;
        }
        .pricing-card {
          background: var(--bg-alt);
          border: 1px solid var(--border);
          padding: 48px;
          text-align: left;
          max-width: 440px;
          width: 100%;
          transition: transform 0.3s ease;
        }
        .pricing-card:hover {
          transform: translateY(-8px);
        }
        .card-header {
          margin-bottom: 40px;
        }
        .plan-name {
          font-family: var(--font-label);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: var(--text-muted);
          display: block;
          margin-bottom: 12px;
        }
        .plan-price {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .currency {
          font-size: 24px;
          font-weight: 700;
          color: var(--text);
        }
        .amount {
          font-family: var(--font-headline);
          font-size: 80px;
          font-weight: 700;
          line-height: 1;
          color: var(--text);
        }
        .period {
          font-size: 16px;
          color: var(--text-muted);
        }
        .plan-features {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .plan-features li {
          font-size: 14px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .plan-features li::before {
          content: '—';
          color: var(--border);
        }

        .theme-kinetic .pricing-card {
          background: var(--bg-overlay);
          border-color: var(--border-default);
        }
        .theme-kinetic .amount {
          font-style: italic;
          font-weight: 400;
        }
        .theme-kinetic .plan-name {
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}
