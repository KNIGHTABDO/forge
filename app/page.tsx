import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚒</div>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-1px', marginBottom: 12 }}>FORGE</h1>
        <p style={{ fontSize: '1.2rem', color: '#64748b', marginBottom: 32, lineHeight: 1.6 }}>Describe a tool in one sentence.<br/>Get a working app. Share it instantly.</p>
        <Link href="/build" style={{ background: '#3b82f6', color: '#fff', padding: '14px 32px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '1rem', display: 'inline-block', transition: 'background 150ms' }}>Start Building →</Link>
      </div>
    </main>
  );
}
