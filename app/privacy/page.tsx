'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import '../home.css';
import '../legal.css';

export default function PrivacyPage() {
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

  if (!mounted) return null;
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
          <Link href="/build" className="nav-cta">Inquire</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="legal-hero">
        <span className="legal-eyebrow">Legal / Protocol</span>
        <h1 className="legal-title"><>Privacy<br />Policy</></h1>
        <p className="legal-subtitle">
          We believe privacy is a right, not a feature. This document explains exactly what we collect, why, and how we protect it.
        </p>
        <p className="legal-meta">Last updated: March 2026</p>
      </section>

      {/* Body */}
      <div className="legal-body">
        {/* Table of Contents */}
        <aside className="legal-toc">
          <p className="legal-toc-title">Contents</p>
          <ul className="legal-toc-list">
            <li><a href="#information-we-collect">01 — Information We Collect</a></li>
            <li><a href="#how-we-use">02 — How We Use Information</a></li>
            <li><a href="#data-sharing">03 — Data Sharing</a></li>
            <li><a href="#cookies">04 — Cookies</a></li>
            <li><a href="#data-retention">05 — Data Retention</a></li>
            <li><a href="#your-rights">06 — Your Rights</a></li>
            <li><a href="#security">07 — Security</a></li>
            <li><a href="#contact">08 — Contact Us</a></li>
          </ul>
        </aside>

        {/* Content */}
        <main className="legal-content">
          <div className="legal-section" id="information-we-collect">
            <span className="legal-section-num">01</span>
            <h2 className="legal-section-title">Information We Collect</h2>
            <p>
              FORGE is designed to be privacy-first. We collect only the minimum data necessary to operate the service effectively.
            </p>
            <p>
              <strong>Information you provide:</strong> When you use FORGE to build an app, we store the prompts you submit and the generated HTML output (including multi-file projects generated in Enhance Mode). This allows us to host your deployed apps and show them in the public gallery.
            </p>
            <p>
              <strong>Automatically collected information:</strong> When you visit FORGE, we may collect standard server logs including your IP address, browser type, referring URL, and pages visited. This data is used solely for security and performance monitoring.
            </p>
            <p>
              <strong>Session data:</strong> We use a session identifier stored in your browser's local storage and reflected in our GitHub-backed session store to associate your builds. No email signup is required.
            </p>
            <p>
              <strong>App Data (BaaS):</strong> If you build an app that saves data, that data is stored in our GitHub-based database (Forge BaaS). This data is associated with your unique session ID.
            </p>
          </div>

          <div className="legal-section" id="how-we-use">
            <span className="legal-section-num">02</span>
            <h2 className="legal-section-title">How We Use Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Generate and host your web applications</li>
              <li>Display your apps in the public gallery (unless you keep them private)</li>
              <li>Improve the quality of AI-generated outputs</li>
              <li>Monitor for abuse, spam, or harmful content</li>
              <li>Maintain the security and integrity of our platform</li>
            </ul>
            <p>
              We do not use your data for advertising purposes, and we do not sell your personal information to third parties under any circumstances.
            </p>
          </div>

          <div className="legal-section" id="data-sharing">
            <span className="legal-section-num">03</span>
            <h2 className="legal-section-title">Data Sharing</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We may share data only in the following limited circumstances:
            </p>
            <ul>
              <li><strong>Service providers:</strong> We use third-party services (such as cloud hosting and AI APIs) to operate FORGE. These providers are bound by strict data processing agreements. This includes Google's Gemini AI API, which powers generation and the embedded gemini-api-dev agent skill.</li>
              <li><strong>Legal compliance:</strong> We may disclose data if required by law or to respond to valid legal process.</li>
              <li><strong>Safety:</strong> We may share data to protect the rights, property, or safety of FORGE, our users, or the public.</li>
            </ul>
          </div>

          <div className="legal-section" id="cookies">
            <span className="legal-section-num">04</span>
            <h2 className="legal-section-title">Cookies</h2>
            <p>
              FORGE uses minimal cookies and browser storage. Specifically, we use:
            </p>
            <ul>
              <li><strong>Local storage:</strong> To save your session ID and current work in progress, so you don&apos;t lose your session if you reload the page.</li>
              <li><strong>Functional cookies:</strong> Strictly necessary cookies that enable core site functionality.</li>
            </ul>
            <p>
              We do not use tracking cookies, advertising cookies, or any third-party analytics that track you across the web. You can clear your browser&apos;s local storage at any time to reset your session. Note that this will disconnect you from any Forge BaaS data associated with that session ID.
            </p>
          </div>

          <div className="legal-section" id="data-retention">
            <span className="legal-section-num">05</span>
            <h2 className="legal-section-title">Data Retention</h2>
            <p>
              <strong>Apps you deploy:</strong> Apps you deploy via FORGE (both single-page and multi-page "Enhanced" apps) are stored on our servers and remain accessible via their unique URL. Session data is retained as long as necessary to maintain the service.
            </p>
            <p>
              If you wish to have your deployed app or associated data removed, please contact us at the address below and we will process your request promptly.
            </p>
          </div>

          <div className="legal-section" id="your-rights">
            <span className="legal-section-num">06</span>
            <h2 className="legal-section-title">Your Rights</h2>
            <p>
              Depending on your location, you may have the following rights regarding your data:
            </p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the data we hold about you</li>
              <li><strong>Deletion:</strong> Request that we delete your data</li>
              <li><strong>Correction:</strong> Request corrections to inaccurate data</li>
              <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Object to certain types of data processing</li>
            </ul>
            <p>
              To exercise any of these rights, please reach out via our <Link href="/contact">contact page</Link> or on Twitter at{' '}
              <a href="https://twitter.com/jip7e" target="_blank" rel="noopener noreferrer">@jip7e</a>.
            </p>
          </div>

          <div className="legal-section" id="security">
            <span className="legal-section-num">07</span>
            <h2 className="legal-section-title">Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including encrypted connections (HTTPS), secure server infrastructure, and regular security reviews.
            </p>
            <p>
              However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee its absolute security.
            </p>
          </div>

          <div className="legal-section" id="contact">
            <span className="legal-section-num">08</span>
            <h2 className="legal-section-title">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or how we handle your data, please reach out:
            </p>
            <ul>
              <li>Twitter / X: <a href="https://twitter.com/jip7e" target="_blank" rel="noopener noreferrer">@jip7e</a></li>
              <li>Contact page: <Link href="/contact">forge.app/contact</Link></li>
            </ul>
            <p>
              We are committed to addressing privacy concerns promptly and transparently.
            </p>
          </div>
        </main>
      </div>

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
