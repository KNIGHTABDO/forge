import Link from 'next/link';
import './not-found.css';

export default function NotFound() {
  return (
    <main className="nf-page">
      <div className="nf-grid" aria-hidden="true" />

      <header className="nf-topbar">
        <Link href="/" className="nf-logo">FORGE</Link>
        <span className="nf-kicker">Error 404</span>
      </header>

      <section className="nf-content">
        <p className="nf-label">Route Missing</p>
        <h1 className="nf-title">This page could not be forged.</h1>
        <p className="nf-copy">
          The link may be outdated, removed, or still being generated.
          Return to the gallery or start a new build in seconds.
        </p>

        <div className="nf-actions">
          <Link href="/" className="nf-btn nf-btn-primary">Back Home</Link>
          <Link href="/build" className="nf-btn">Open Builder</Link>
        </div>
      </section>
    </main>
  );
}