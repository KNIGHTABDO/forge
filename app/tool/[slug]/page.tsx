import { getToolHTML, getToolMeta } from '@/lib/github';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import './tool.css';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getToolMeta(slug);
  return {
    title: meta?.title ? `${meta.title} | FORGE` : `${slug} | FORGE`,
    description: meta?.description || 'An app built with FORGE',
  };
}

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const [html, meta] = await Promise.all([getToolHTML(slug), getToolMeta(slug)]);

  if (!html) {
    notFound();
  }

  return (
    <div className="tool-page">
      <header className="tool-header">
        <a href="/" className="tool-logo">FORGE</a>
        <div className="tool-info">
          <h1 className="tool-title">{meta?.title || slug}</h1>
          {meta?.description && (
            <p className="tool-desc">{meta.description}</p>
          )}
        </div>
        <div className="tool-actions">
          <a href="/" className="tool-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Home
          </a>
          <a href="/build" className="tool-btn tool-btn-primary">
            Build Your Own
          </a>
        </div>
      </header>
      <main className="tool-frame-wrap">
        <iframe
          srcDoc={html}
          className="tool-frame"
          title={meta?.title || slug}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </main>
    </div>
  );
}
