import type { Metadata } from 'next';
import Link from 'next/link';
import '../home.css';
import '../legal.css';

export const metadata: Metadata = {
  title: 'Contact — FORGE',
  description: 'Get in touch with the FORGE team. Find us on Twitter @jip7e.',
};

export default function ContactPage() {
  return (
    <div className="legal-page">
      {/* Navigation */}
      <nav className="nav">
        <Link href="/" className="nav-logo forge-wordmark">FORGE</Link>
        <div className="nav-links">
          <Link href="/#how" className="nav-link">How it works</Link>
          <Link href="/#gallery" className="nav-link">Gallery</Link>
        </div>
        <div className="nav-right">
          <Link href="/build" className="nav-cta">Inquire</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="legal-hero">
        <span className="legal-eyebrow">Contact / Protocol</span>
        <h1 className="legal-title">Get in<br />Touch</h1>
        <p className="legal-subtitle">
          Have a question, idea, or issue? We&apos;re a small team that moves fast. The best way to reach us is on Twitter.
        </p>
      </section>

      {/* Contact Cards */}
      <div style={{ padding: '80px 48px', maxWidth: '960px' }}>
        <div className="contact-grid">
          {/* Twitter / X */}
          <div className="contact-card">
            <svg className="contact-card-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
            <span className="contact-card-label">Social</span>
            <h3 className="contact-card-title">Twitter / X</h3>
            <p className="contact-card-desc">
              The fastest way to reach us. DMs are open. Follow for updates, announcements, and behind-the-scenes content.
            </p>
            <a
              href="https://twitter.com/jip7e"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-card-link"
            >
              @jip7e
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 11L11 1M11 1H4M11 1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>

          {/* General Inquiries */}
          <div className="contact-card">
            <svg className="contact-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            <span className="contact-card-label">General</span>
            <h3 className="contact-card-title">General Inquiries</h3>
            <p className="contact-card-desc">
              Questions about the platform, partnerships, press, or anything else. Reach out and we&apos;ll get back to you.
            </p>
            <a
              href="https://twitter.com/jip7e"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-card-link"
            >
              Message us
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 11L11 1M11 1H4M11 1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>

          {/* Bug Reports */}
          <div className="contact-card">
            <svg className="contact-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <span className="contact-card-label">Support</span>
            <h3 className="contact-card-title">Bug Reports</h3>
            <p className="contact-card-desc">
              Found a bug or something not working as expected? Let us know with a description and we&apos;ll fix it fast.
            </p>
            <a
              href="https://twitter.com/jip7e"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-card-link"
            >
              Report issue
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 11L11 1M11 1H4M11 1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>

          {/* Privacy / Legal */}
          <div className="contact-card">
            <svg className="contact-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="contact-card-label">Legal</span>
            <h3 className="contact-card-title">Privacy &amp; Legal</h3>
            <p className="contact-card-desc">
              Data removal requests, privacy questions, or legal matters. Review our{' '}
              <Link href="/privacy">Privacy Policy</Link> and{' '}
              <Link href="/terms">Terms of Service</Link> first.
            </p>
            <a
              href="https://twitter.com/jip7e"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-card-link"
            >
              Contact for legal
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 11L11 1M11 1H4M11 1V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>

        {/* CTA row */}
        <div style={{ marginTop: '80px', borderTop: '1px solid var(--border)', paddingTop: '80px' }}>
          <span className="legal-eyebrow">Follow the Build</span>
          <h2 style={{ fontFamily: 'var(--font-headline)', fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px', marginTop: '20px' }}>
            Stay in the loop
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '480px', marginBottom: '32px' }}>
            Follow <a href="https://twitter.com/jip7e" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', textDecoration: 'underline', textDecorationColor: 'var(--border)', textUnderlineOffset: '3px' }}>@jip7e</a> on Twitter for updates on new features, app showcases, and the story behind FORGE.
          </p>
          <a
            href="https://twitter.com/jip7e"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
          >
            Follow @jip7e on X
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.734l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
          </a>
        </div>
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
