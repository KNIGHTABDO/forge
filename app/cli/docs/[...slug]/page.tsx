'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { useParams } from 'next/navigation';
import '../../../home.css';
import '../../../legal.css';

// Documentation content map
const docsContent: Record<string, { title: string; subtitle: string; sections: { id: string; num: string; title: string; content: React.ReactNode }[] }> = {
  general: {
    title: 'Forge Desktop Docs',
    subtitle: 'The native AI development app for local-first engineering.',
    sections: [
      {
        id: 'getting-started',
        num: '01',
        title: 'Getting Started',
        content: (
          <>
            <p>Welcome to Forge Desktop. Use this native app to build, debug, and understand full codebases with a modern desktop UI.</p>
            <p>Open the app, authenticate once, then select your workspace folder to start building.</p>
          </>
        )
      }
    ]
  },
  security: {
    title: 'Security',
    subtitle: 'Understanding the security model for Forge Desktop sessions.',
    sections: [
      {
        id: 'prompt-injection',
        num: '01',
        title: 'Prompt Injection Risks',
        content: (
          <>
            <p><strong>Note:</strong> Forge can make mistakes. You should always review Forge\'s responses, especially when running code.</p>
            <p>Because Forge automates terminal commands, reading untrusted text files or repositories can lead to "Prompt Injection", where instructions hidden in the files trick the AI into running malicious commands.</p>
            <p><strong>Never grant filesystem access to untrusted repositories without review.</strong></p>
          </>
        )
      },
      {
        id: 'sandbox',
        num: '02',
        title: 'Sandboxing',
        content: (
          <p>
            For maximum safety, run experimental workspaces in isolated folders, virtual machines, or containers when working with untrusted third-party code.
          </p>
        )
      }
    ]
  }
};

export default function DocsPage() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const params = useParams();

  // Extract the specific slug or fallback to general
  const slugs = params?.slug as string[] || [];
  const requestedDoc = slugs[slugs.length - 1]?.toLowerCase() || 'general';
  
  // Try to find the document, fallback to general if not found
  const docData = docsContent[requestedDoc] || {
    title: requestedDoc.charAt(0).toUpperCase() + requestedDoc.slice(1).replace(/-/g, ' '),
    subtitle: 'Documentation for Forge Desktop.',
    sections: [
      {
        id: 'info',
        num: '01',
        title: 'Information',
        content: <p>Placeholder documentation page for <strong>{requestedDoc}</strong>. Detailed content coming soon.</p>
      }
    ]
  };

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
          <Link href="/research/new" className="nav-link">Deep Research</Link>
          <Link href="/pricing" className="nav-link">Pricing</Link>
        </div>
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <ThemeToggle />
          <Link href="/build" className="nav-cta">Inquire</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="legal-hero">
        <span className="legal-eyebrow">Documentation / Desktop</span>
        <h1 className="legal-title">{docData.title}</h1>
        <p className="legal-subtitle">
          {docData.subtitle}
        </p>
      </section>

      {/* Body */}
      <div className="legal-body">
        {/* Table of Contents */}
        <aside className="legal-toc">
          <p className="legal-toc-title">Contents</p>
          <ul className="legal-toc-list">
            {docData.sections.map(section => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.num} — {section.title}</a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content */}
        <main className="legal-content">
          {docData.sections.map(section => (
            <div className="legal-section" id={section.id} key={section.id}>
              <span className="legal-section-num">{section.num}</span>
              <h2 className="legal-section-title">{section.title}</h2>
              <div className="legal-section-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {section.content}
              </div>
            </div>
          ))}
        </main>
      </div>

    </div>
  );
}
