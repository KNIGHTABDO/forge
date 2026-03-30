'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import '../home.css';
import '../legal.css';

export default function TermsPage() {
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
        <h1 className="legal-title"><>Terms of<br />Service</></h1>
        <p className="legal-subtitle">
          By using FORGE, you agree to these terms. Please read them carefully — they are written to be clear and fair.
        </p>
        <p className="legal-meta">Last updated: March 30, 2026 — Effective immediately</p>
      </section>

      {/* Body */}
      <div className="legal-body">
        {/* Table of Contents */}
        <aside className="legal-toc">
          <p className="legal-toc-title">Contents</p>
          <ul className="legal-toc-list">
            <li><a href="#acceptance">01 — Acceptance of Terms</a></li>
            <li><a href="#description">02 — Description of Service</a></li>
            <li><a href="#use-of-service">03 — Use of the Service</a></li>
            <li><a href="#content">04 — User Content</a></li>
            <li><a href="#intellectual-property">05 — Intellectual Property</a></li>
            <li><a href="#disclaimers">06 — Disclaimers</a></li>
            <li><a href="#limitation">07 — Limitation of Liability</a></li>
            <li><a href="#termination">08 — Termination</a></li>
            <li><a href="#changes">09 — Changes to Terms</a></li>
            <li><a href="#contact">10 — Contact</a></li>
          </ul>
        </aside>

        {/* Content */}
        <main className="legal-content">
          <div className="legal-section" id="acceptance">
            <span className="legal-section-num">01</span>
            <h2 className="legal-section-title">Acceptance of Terms</h2>
            <p>
              By accessing or using FORGE (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
            <p>
              These Terms apply to all visitors, users, and others who access or use the Service. By using FORGE, you represent that you are at least 13 years of age.
            </p>
          </div>

          <div className="legal-section" id="description">
            <span className="legal-section-num">02</span>
            <h2 className="legal-section-title">Description of Service</h2>
            <p>
              FORGE is an AI-powered web application builder that allows users to describe an idea in plain English and receive a fully functional interactive web app. Features include:
            </p>
            <ul>
              <li>Unified React Orchestration (Conversational Chat + Building)</li>
              <li>📦 Sandpack V3 Build Engine for browser-based React development</li>
              <li>🔄 Continuous background session syncing to GitHub (Auto-Save)</li>
              <li>Deep Research Agent (Beta) on a dedicated standalone conversational workflow route</li>
              <li>Delta-Sync: Incremental multi-file updates to your project</li>
              <li>Automated branding with "Smart Title" analysis</li>
              <li>Forge BaaS for cloud-synced micro-SaaS data persistence</li>
              <li>Public gallery and remix capabilities for community projects</li>
            </ul>
            <p>
              We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
            </p>
          </div>

          <div className="legal-section" id="use-of-service">
            <span className="legal-section-num">03</span>
            <h2 className="legal-section-title">Use of the Service</h2>
            <p>You agree to use the Service only for lawful purposes. You must not:</p>
            <ul>
              <li>Generate apps containing illegal, harmful, abusive, threatening, or harassing content</li>
              <li>Create content that infringes on the intellectual property rights of others</li>
              <li>Attempt to reverse engineer, hack, or disrupt the Service or its infrastructure</li>
              <li>Use automated means to excessively query or scrape the Service</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Generate malicious code, phishing pages, or any software designed to harm users</li>
              <li>Use the Service to generate adult content involving minors</li>
            </ul>
            <p>
              We reserve the right to remove any content and suspend any account that violates these guidelines without prior notice.
            </p>
          </div>

          <div className="legal-section" id="content">
            <span className="legal-section-num">04</span>
            <h2 className="legal-section-title">User Content</h2>
            <p>
              <strong>Your ownership:</strong> You retain ownership of the prompts you provide and the concepts behind the apps you create. The generated output code is yours to use.
            </p>
            <p>
              <strong>License to FORGE:</strong> By deploying an app through FORGE, you grant us a worldwide, non-exclusive, royalty-free license to host, display, and share that app (including in the public gallery) for the purpose of operating the Service.
            </p>
            <p>
              <strong>Responsibility:</strong> You are solely responsible for the content of apps you create and deploy. FORGE does not endorse any user-created content and is not responsible for its accuracy, legality, or suitability.
            </p>
            <p>
              <strong>Public gallery:</strong> Apps you deploy (including multi-page projects) may appear in the public gallery, visible to all visitors. If you wish to have your app removed from the gallery, contact us.
            </p>
            <p>
              <strong>Data Persistence:</strong> Apps that use Forge BaaS for data storage will have their data persisted on our servers via GitHub storage. You are responsible for any personal data you input into these apps.
            </p>
          </div>

          <div className="legal-section" id="intellectual-property">
            <span className="legal-section-num">05</span>
            <h2 className="legal-section-title">Intellectual Property</h2>
            <p>
              The FORGE platform, including its design, logo, name, and underlying technology, is owned by FORGE DIGITAL and is protected by applicable intellectual property laws.
            </p>
            <p>
              The AI models used by FORGE are provided by third-party providers. Generated code is provided &quot;as-is&quot; without warranty of fitness for any particular purpose.
            </p>
          </div>

          <div className="legal-section" id="disclaimers">
            <span className="legal-section-num">06</span>
            <h2 className="legal-section-title">Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT:
            </p>
            <ul>
              <li>The Service will be uninterrupted, error-free, or secure</li>
              <li>Any generated code will be bug-free or suitable for production use</li>
              <li>The Service will meet your specific requirements</li>
              <li>Any defects in the Service will be corrected</li>
            </ul>
            <p>
              AI-generated apps are provided for convenience and experimentation. We strongly recommend reviewing generated code before using it in any production environment.
            </p>
          </div>

          <div className="legal-section" id="limitation">
            <span className="legal-section-num">07</span>
            <h2 className="legal-section-title">Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FORGE DIGITAL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
            </p>
            <p>
              Our total liability to you for any claims arising from use of the Service shall not exceed the amount you have paid us in the twelve months preceding the claim (or $10 if you have paid nothing).
            </p>
          </div>

          <div className="legal-section" id="termination">
            <span className="legal-section-num">08</span>
            <h2 className="legal-section-title">Termination</h2>
            <p>
              We may terminate or suspend your access to the Service immediately, without prior notice, for conduct that we determine violates these Terms or is harmful to other users, us, third parties, or for any other reason at our sole discretion.
            </p>
            <p>
              Upon termination, your right to use the Service ceases immediately. Provisions of these Terms that by their nature should survive termination shall survive.
            </p>
          </div>

          <div className="legal-section" id="changes">
            <span className="legal-section-num">09</span>
            <h2 className="legal-section-title">Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. When we make changes, we will update the &quot;Last updated&quot; date at the top of this page.
            </p>
            <p>
              Your continued use of the Service after any changes constitutes your acceptance of the new Terms. We encourage you to review these Terms periodically.
            </p>
          </div>

          <div className="legal-section" id="contact">
            <span className="legal-section-num">10</span>
            <h2 className="legal-section-title">Contact</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <ul>
              <li>Twitter / X: <a href="https://twitter.com/jip7e" target="_blank" rel="noopener noreferrer">@jip7e</a></li>
              <li>Contact page: <Link href="/contact">forge.app/contact</Link></li>
            </ul>
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
