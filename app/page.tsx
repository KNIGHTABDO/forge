'use client';

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Environment, MeshDistortMaterial } from '@react-three/drei';
import type { GalleryEntry } from '@/lib/github';
import * as THREE from 'three';
import './home.css';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// Floating metallic sphere for 3D background
function FloatingSphere({ position, scale, speed = 1 }: { position: [number, number, number]; scale: number; speed?: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.1 * speed;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15 * speed;
    }
  });

  return (
    <Float speed={speed} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={meshRef} position={position} scale={scale}>
        <icosahedronGeometry args={[1, 1]} />
        <MeshDistortMaterial
          color="#ffffff"
          metalness={0.9}
          roughness={0.1}
          distort={0.3}
          speed={2}
        />
      </mesh>
    </Float>
  );
}

// Spark particles
function Sparks() {
  const count = 50;
  const meshRef = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      
      // Orange and white sparks
      const isOrange = Math.random() > 0.5;
      colors[i * 3] = 1;
      colors[i * 3 + 1] = isOrange ? 0.6 : 1;
      colors[i * 3 + 2] = isOrange ? 0 : 1;
    }
    
    return { positions, colors };
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.03;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
}

// 3D Scene
function Scene3D() {
  return (
    <>
      <Environment preset="night" />
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} intensity={1} color="#ff9d00" />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#00d4ff" />
      <spotLight position={[0, 5, 0]} intensity={1} angle={0.3} penumbra={1} color="#ffffff" />
      
      <FloatingSphere position={[-4, 2, -3]} scale={0.8} speed={0.8} />
      <FloatingSphere position={[4, -1, -4]} scale={0.5} speed={1.2} />
      <FloatingSphere position={[3, 3, -5]} scale={0.3} speed={1.5} />
      <FloatingSphere position={[-3, -2, -2]} scale={0.4} speed={1} />
      
      <Sparks />
    </>
  );
}

function LazyIframe({ src, title }: { src: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setLoaded(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="tool-card-preview">
      {loaded ? (
        <iframe
          src={src}
          title={title}
          scrolling="no"
          tabIndex={-1}
          sandbox="allow-scripts allow-same-origin"
          className="tool-card-iframe"
        />
      ) : (
        <div className="tool-card-skeleton" />
      )}
      <div className="tool-card-preview-overlay" />
    </div>
  );
}

function ToolCard({ tool, index }: { tool: GalleryEntry; index: number }) {
  const toolUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/t/${tool.slug}`;
  const delay = String(Math.min((index % 4) + 1, 4));
  return (
    <div className="tool-card" data-animate data-delay={delay}>
      <LazyIframe src={toolUrl} title={tool.title || tool.slug} />
      <div className="tool-card-body">
        <div className="tool-card-meta">
          <span className="tool-card-slug">/t/{tool.slug}</span>
          <span className="tool-card-time">{timeAgo(tool.updated ?? tool.created)}</span>
        </div>
        <h3 className="tool-card-title">{tool.title || tool.slug}</h3>
        {tool.description && <p className="tool-card-desc">{tool.description}</p>}
        <div className="tool-card-actions">
          <a href={toolUrl} target="_blank" rel="noopener" className="tool-card-btn open">Open</a>
          <Link href={`/build?tool=${tool.slug}`} className="tool-card-btn edit">Edit</Link>
        </div>
      </div>
    </div>
  );
}

// Features section
function FeaturesSection() {
  const features = [
    {
      icon: '01',
      title: 'Describe Your Idea',
      description: 'Type a single sentence describing the tool you want. Our AI understands context and intent.'
    },
    {
      icon: '02', 
      title: 'Instant Generation',
      description: 'Watch as your fully functional web application is forged in real-time, code and all.'
    },
    {
      icon: '03',
      title: 'Deploy & Share',
      description: 'Your app gets a unique URL instantly. Share it with anyone, anywhere in the world.'
    }
  ];

  return (
    <section className="features-section">
      <div className="features-header" data-animate>
        <span className="features-label">How It Works</span>
        <h2 className="features-title">From idea to app in seconds</h2>
      </div>
      <div className="features-grid">
        {features.map((feature, i) => (
          <div key={i} className="feature-card" data-animate data-delay={String(i + 1)}>
            <div className="feature-number">{feature.icon}</div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-desc">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [tools, setTools] = useState<GalleryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const homeRef = useRef<HTMLElement>(null);
  const router = useRouter();

  const startNewSession = () => {
    localStorage.removeItem('forge-session-id');
    router.push('/build');
  };

  useEffect(() => {
    fetch('/api/gallery')
      .then(r => r.json())
      .then(data => { setTools(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Navbar scroll shadow
  useEffect(() => {
    const home = homeRef.current;
    if (!home) return;
    const nav = home.querySelector('.home-nav') as HTMLElement | null;
    if (!nav) return;
    const handleScroll = () => nav.classList.toggle('scrolled', home.scrollTop > 20);
    home.addEventListener('scroll', handleScroll, { passive: true });
    return () => home.removeEventListener('scroll', handleScroll);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return tools;
    const q = query.toLowerCase();
    return tools.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  }, [tools, query]);

  // Scroll-reveal
  useEffect(() => {
    const home = homeRef.current;
    if (!home) return;
    const observer = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('animate-in'); observer.unobserve(entry.target); }
      }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px', root: home }
    );
    home.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [filtered]);

  return (
    <main className="home" ref={homeRef}>
      {/* 3D Background Canvas */}
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 8], fov: 50 }}>
          <Suspense fallback={null}>
            <Scene3D />
          </Suspense>
        </Canvas>
      </div>

      {/* Gradient overlays */}
      <div className="hero-gradient-top" />
      <div className="hero-gradient-bottom" />

      <nav className="home-nav">
        <Link href="/" className="home-nav-logo">
          <span className="home-nav-logo-text">FORGE</span>
        </Link>
        <div className="nav-links">
          <a href="#features" className="nav-link">How It Works</a>
          <a href="#gallery" className="nav-link">Gallery</a>
          <button onClick={startNewSession} className="home-nav-cta">Start Forging</button>
        </div>
      </nav>

      <section className="home-hero">
        {/* Hero Anvil Image */}
        <div className="hero-image-container hero-anim hero-anim-1">
          <img 
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Image%201%203-9oV0oa1aeNppoWJMX10ZOBibQIKHI4.png"
            alt="Metallic anvil being struck with sparks flying"
            className="hero-anvil-image"
          />
          <div className="hero-image-glow" />
        </div>

        <h1 className="home-hero-title hero-anim hero-anim-2">
          FORGE ANY APP
        </h1>

        <p className="home-hero-sub hero-anim hero-anim-3">
          Describe your idea in one sentence. Get a fully working
          interactive web app instantly. No code. No limits.
        </p>

        <div className="home-hero-actions hero-anim hero-anim-4">
          <button onClick={startNewSession} className="forge-btn-primary">
            <span className="forge-btn-text">START FORGING</span>
            <div className="forge-btn-sparks">
              <span className="spark spark-1" />
              <span className="spark spark-2" />
              <span className="spark spark-3" />
            </div>
          </button>
        </div>

        <div className="home-hero-stats hero-anim hero-anim-5">
          <div className="home-hero-stat">
            <span className="home-hero-stat-num">0.024ms</span>
            <span className="home-hero-stat-lbl">Latency</span>
          </div>
          <div className="home-hero-stat-sep" />
          <div className="home-hero-stat">
            <span className="home-hero-stat-num">V.04</span>
            <span className="home-hero-stat-lbl">Engine</span>
          </div>
        </div>
      </section>

      <FeaturesSection />

      <section className="home-gallery" id="gallery">
        <div className="gallery-header" data-animate>
          <div className="gallery-heading-group">
            <h2 className="gallery-heading">Previously Forged</h2>
            {!loading && tools.length > 0 && (
              <span className="gallery-count">{tools.length}</span>
            )}
          </div>
          <div className="gallery-search-wrap">
            <span className="gallery-search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              className="gallery-search"
              type="search"
              placeholder="Search tools..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              spellCheck={false}
            />
            {query && (
              <button className="gallery-search-clear" onClick={() => setQuery('')} aria-label="Clear">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="gallery-loading">
            <span className="gen-dot"/><span className="gen-dot"/><span className="gen-dot"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="gallery-empty">
            {query ? `No tools matching "${query}"` : 'No tools built yet — be the first!'}
          </div>
        ) : (
          <div className="gallery-grid">
            {filtered.map((t, i) => <ToolCard key={t.slug} tool={t} index={i} />)}
          </div>
        )}
      </section>

      <footer className="home-footer">
        <div className="footer-content">
          <span className="footer-text">Powered by</span>
          <span className="footer-logo">FORGE</span>
        </div>
        <div className="footer-meta">
          <span>Engine V.04-KINETIC</span>
        </div>
      </footer>
    </main>
  );
}
