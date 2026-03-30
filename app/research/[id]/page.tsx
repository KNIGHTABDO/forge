'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ThemeToggle } from '@/components/theme-toggle';
import '../research.css';

/* ─── Types ─── */
interface ResearchStats {
  sourcesAnalyzed: number;
  tokensUsedEstimate: number;
  depthScore: number;
  queriesGenerated: number;
  iterations: number;
  uniqueDomains: number;
}

interface ResearchWebsite {
  id: string;
  url: string;
  domain: string;
  title: string;
  status: 'queued' | 'fetching' | 'analyzed' | 'failed';
  favicon: string;
}

interface ResearchEvent {
  id: string;
  at: string;
  phase: string;
  message: string;
}

interface ResearchReport {
  title: string;
  summary: string;
  sections: { id: string; title: string; body: string }[];
  citations: { id: number; url: string; domain: string; title: string }[];
}

interface StatusPayload {
  id: string;
  query: string;
  phase: string;
  progress: number;
  etaMinutes: number;
  planDraft: string;
  planFinal?: string;
  planApproved: boolean;
  stats: ResearchStats;
  websites: ResearchWebsite[];
  learnedSoFar: string[];
  events: ResearchEvent[];
  hasReport: boolean;
  error?: string;
}

const defaultStats: ResearchStats = {
  sourcesAnalyzed: 0,
  tokensUsedEstimate: 0,
  depthScore: 0,
  queriesGenerated: 0,
  iterations: 0,
  uniqueDomains: 0,
};

const phaseLabels: Record<string, string> = {
  awaiting_plan: 'Awaiting your approval',
  query_fanout: 'Generating search queries',
  analyzing: 'Searching the web',
  synthesizing: 'Writing final report',
  complete: 'Research complete',
  paused: 'Paused',
  stopped: 'Stopped',
  error: 'Error occurred',
};

const friendlyPhase = (phase: string) => phaseLabels[phase] || phase.replace(/_/g, ' ');

const statusLabel: Record<string, string> = {
  queued: 'Queued',
  fetching: 'Reading',
  analyzed: 'Done',
  failed: 'Failed',
};

/* ─── Animated counter ─── */
function AnimVal({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (display === value) return;
    const start = display;
    const t0 = performance.now();
    const dur = 400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - t0) / dur, 1);
      setDisplay(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [display, value]);
  return <>{display.toLocaleString()}</>;
}

/* ─── Skeleton Loader ─── */
function Skeleton() {
  return (
    <div className="dr-card dr-msg dr-msg-agent">
      <div className="dr-skeleton">
        <div className="dr-skeleton-line" style={{ width: '60%' }} />
        <div className="dr-skeleton-line" style={{ width: '85%' }} />
        <div className="dr-skeleton-line" style={{ width: '72%' }} />
        <div className="dr-skeleton-line" style={{ width: '90%' }} />
        <div className="dr-skeleton-line" style={{ width: '55%' }} />
      </div>
    </div>
  );
}

/* ─── Thinking Indicator ─── */
function ThinkingOrb({ title, description }: { title: string; description: string }) {
  return (
    <div className="dr-card dr-msg dr-msg-agent">
      <div className="dr-thinking">
        <div className="dr-thinking-orb">
          <span className="dr-thinking-orb-core" />
          <span className="dr-thinking-orb-ring" />
          <span className="dr-thinking-orb-spark" />
          <span className="dr-thinking-orb-spark" />
        </div>
        <div className="dr-thinking-content">
          <p className="dr-thinking-title">{title}</p>
          <p className="dr-thinking-desc">{description}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Send Arrow Icon ─── */
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════ */
export default function ResearchPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const feedRef = useRef<HTMLDivElement | null>(null);
  const id = params.id;

  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState('');
  const [planEdit, setPlanEdit] = useState(true);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [liveEvents, setLiveEvents] = useState<ResearchEvent[]>([]);
  const [liveWebsites, setLiveWebsites] = useState<ResearchWebsite[]>([]);
  const [liveLearned, setLiveLearned] = useState<string[]>([]);
  const [chat, setChat] = useState<{ role: 'user' | 'agent'; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [composerValue, setComposerValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);

  const isNew = id === 'new';
  const isComplete = status?.phase === 'complete';
  const isRunning = status && !['complete', 'stopped', 'error', 'awaiting_plan'].includes(status.phase);

  const sessionId = useMemo(() => {
    const fromUrl = searchParams.get('session');
    if (fromUrl) return fromUrl;
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem('forge-research-session');
    if (stored) return stored;
    const created = `sess_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('forge-research-session', created);
    return created;
  }, [searchParams]);

  const statusEndpoint = useMemo(() => {
    if (!id || id === 'new') return '';
    return `/api/research/${id}/status?session=${encodeURIComponent(sessionId)}`;
  }, [id, sessionId]);

  /* ─── Polling ─── */
  const pullStatus = async (advance = true) => {
    if (!statusEndpoint) return;
    const res = await fetch(`${statusEndpoint}&advance=${advance ? '1' : '0'}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch status');
    setStatus(data);
    setPlan(data.planFinal || data.planDraft || '');
    setPlanEdit(!data.planApproved);
    if (data.chat) {
      setChat((prev) => (data.chat.length >= prev.length ? data.chat : prev));
    }

    if (data.hasReport) {
      const reportRes = await fetch(`/api/research/${id}/report?session=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      if (reportRes.ok) setReport(await reportRes.json());
    }
  };

  useEffect(() => {
    if (!statusEndpoint) return;
    let active = true;
    const tick = async () => {
      try {
        if (active) await pullStatus(true);
      } catch (e: any) {
        if (active) setError(e.message || 'Status polling failed');
      }
    };
    tick();
    const interval = setInterval(tick, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [statusEndpoint]);

  useEffect(() => {
    if (!id || id === 'new') return;
    let active = true;
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/research/${id}/events?session=${encodeURIComponent(sessionId)}&limit=80`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !active) return;
        setLiveEvents(data.events || []);
        setLiveWebsites(data.websites || []);
        setLiveLearned(data.learnedSoFar || []);
      } catch { /* status polling is source of truth */ }
    };
    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [id, sessionId]);

  useEffect(() => {
    if (isRunning && !showSidebar) setShowSidebar(true);
  }, [isRunning]);

  useEffect(() => {
    if (isNew) return;
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
  }, [isNew, status?.phase, liveEvents.length, liveWebsites.length, report?.title, error, chat.length, chatLoading]);

  /* ─── Actions ─── */
  const startResearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const body = JSON.stringify({ query, sessionId, id: id === 'new' ? undefined : id });
      let res = await fetch('/api/research/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 500));
        res = await fetch('/api/research/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to launch deep research.');
      localStorage.setItem('forge-research-session', data.sessionId);
      router.replace(`/research/${data.id}?session=${encodeURIComponent(data.sessionId)}`);
    } catch (e: any) {
      setError(e.message || 'Unable to launch deep research.');
    } finally {
      setLoading(false);
    }
  };

  const control = async (action: 'pause' | 'resume' | 'stop' | 'approve-plan' | 'update-plan') => {
    if (!id || id === 'new') return;
    setError(null);
    try {
      const payload: Record<string, string> = { action, sessionId };
      if (action === 'approve-plan' || action === 'update-plan') payload.plan = plan;
      const res = await fetch(`/api/research/${id}/control`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Control request failed');
      await pullStatus(false);
    } catch (e: any) {
      setError(e.message || 'Control request failed');
    }
  };

  const submitFollowUp = async (e: FormEvent) => {
    e.preventDefault();
    const q = composerValue.trim();
    if (!q || !isComplete || !id || id === 'new') return;
    setError(null);
    setComposerValue('');
    setChat(prev => [...prev, { role: 'user', content: q }]);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/research/${id}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat request failed');
      if (data.chat) setChat(data.chat);
      await pullStatus(false);
    } catch (e: any) {
      setError(e.message || 'Chat request failed');
    } finally {
      setChatLoading(false);
    }
  };

  const parseCitations = (text: string) => {
    return text.replace(/\[([\d, ]+)\]/g, (match, digits) => {
      return '[' + digits.split(',').map((d: string) => {
        const num = d.trim();
        return `[${num}](#citation-${num})`;
      }).join(', ') + ']';
    });
  };

  const exportMarkdown = async () => {
    if (!id || id === 'new') return;
    const res = await fetch(`/api/research/${id}/report?session=${encodeURIComponent(sessionId)}&format=md`);
    if (!res.ok) return;
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deep-research-${id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ─── Derived Data ─── */
  const websites = liveWebsites.length > 0 ? liveWebsites : status?.websites || [];
  const learned = liveLearned.length > 0 ? liveLearned : status?.learnedSoFar || [];
  const events = liveEvents.length > 0 ? liveEvents : status?.events || [];
  const stats = status?.stats || defaultStats;

  /* ═══ Render ═══ */
  return (
    <div className="dr-shell">
      {/* Ambient orbs */}
      <div className="dr-ambient" aria-hidden="true">
        <div className="dr-ambient-orb" />
        <div className="dr-ambient-orb" />
        <div className="dr-ambient-orb" />
      </div>

      {/* Top bar */}
      <header className="dr-topbar">
        <div className="dr-topbar-left">
          <Link href="/" className="dr-logo">FORGE</Link>
          <span className="dr-topbar-sep">/</span>
          <span className="dr-topbar-label">
            <span className="dr-beta-dot" />
            <span>Deep Research</span>
          </span>
          <nav className="dr-topbar-nav" style={{ marginLeft: 32, display: 'flex', gap: 24, fontSize: 13, fontWeight: 500 }}>
            <Link href="/#how" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>How it works</Link>
            <Link href="/changelog" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Changelog</Link>
            <Link href="/pricing" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Pricing</Link>
          </nav>
        </div>
        <div className="dr-topbar-right">
          {!isNew && (
            <>
              {isRunning && (
                <>
                  <button className="dr-topbar-btn" onClick={() => control('pause')}>Pause</button>
                  <button className="dr-topbar-btn dr-topbar-btn--danger" onClick={() => control('stop')}>Stop</button>
                </>
              )}
              {status?.phase === 'paused' && (
                <button className="dr-topbar-btn" onClick={() => control('resume')}>Resume</button>
              )}
              {!isNew && (
                <button
                  className="dr-topbar-btn"
                  onClick={() => setShowSidebar(v => !v)}
                  title="Toggle activity panel"
                >
                  {showSidebar ? '✕' : '☰'}
                </button>
              )}
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main area */}
      <div className={`dr-main ${showSidebar && !isNew ? 'has-sidebar' : ''}`}>
        <div className="dr-chat-col">
          {isNew ? (
            /* ─── Start Screen ─── */
            <div className="dr-start">
              <div className="dr-start-icon">🔬</div>
              <h1 className="dr-start-title">Deep Research</h1>
              <p className="dr-start-desc">
                Ask anything. The agent will search the web, analyze dozens of sources,
                and produce a comprehensive cited report.
              </p>
              <div className="dr-composer dr-composer--start">
                <form className="dr-composer-inner" onSubmit={(e) => { e.preventDefault(); startResearch(); }}>
                  <textarea
                    className="dr-composer-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startResearch(); } }}
                    placeholder="What do you want to research deeply?"
                    autoFocus
                  />
                  <button className="dr-composer-send" type="submit" disabled={!query.trim() || loading} aria-label="Start research">
                    <ArrowIcon />
                  </button>
                </form>
              </div>
              {error && <p className="dr-error">{error}</p>}
            </div>
          ) : (
            /* ─── Chat Feed ─── */
            <>
              <div className="dr-feed" ref={feedRef}>
                {/* User query bubble */}
                {status?.query && (
                  <div className="dr-msg dr-msg-user">{status.query}</div>
                )}

                {/* Plan card */}
                {status && !status.planApproved && (
                  <div className="dr-card dr-msg dr-msg-agent">
                    <div className="dr-card-header">
                      <h3>Research Plan</h3>
                      <span className="dr-badge">Editable</span>
                    </div>
                    <div className="dr-card-body">
                      <textarea
                        className="dr-plan-textarea"
                        value={plan}
                        onChange={(e) => setPlan(e.target.value)}
                        disabled={!planEdit}
                      />
                      <div className="dr-plan-actions">
                        <button className="dr-btn" onClick={() => setPlanEdit(v => !v)}>
                          {planEdit ? 'Lock' : 'Edit'}
                        </button>
                        <button className="dr-btn" onClick={() => control('update-plan')}>Save</button>
                        <button className="dr-btn dr-btn--primary" onClick={() => control('approve-plan')}>
                          Start Research
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thinking indicator */}
                {status && !['complete', 'stopped', 'error'].includes(status.phase) && status.planApproved && (
                  <ThinkingOrb
                    title={friendlyPhase(status.phase)}
                    description={
                      status.phase === 'query_fanout'
                        ? 'Generating search queries across multiple angles...'
                        : status.phase === 'analyzing'
                        ? `Analyzing sources... ${stats.sourcesAnalyzed} found so far`
                        : status.phase === 'synthesizing'
                        ? 'Compiling findings into a comprehensive report...'
                        : 'Initializing research agent...'
                    }
                  />
                )}

                {/* Skeleton while loading */}
                {!status && !isNew && <Skeleton />}

                {/* Sources & Stats card */}
                {websites.length > 0 && (
                  <div className="dr-card dr-msg dr-msg-agent">
                    <div className="dr-card-header">
                      <h3>Analyzing Sources</h3>
                      <span className={`dr-badge ${isRunning ? 'dr-badge--live' : ''}`}>
                        {stats.sourcesAnalyzed} / {stats.uniqueDomains} domains
                      </span>
                    </div>
                    <div className="dr-card-body">
                      <div className="dr-sources-single">
                        {[
                          websites.find(s => s.status === 'fetching') || 
                          websites.find(s => s.status === 'queued') || 
                          [...websites].reverse().find(s => s.status === 'analyzed') || 
                          [...websites].reverse().find(s => s.status === 'failed') || 
                          websites[0]
                        ].filter(Boolean).map((site) => (
                          <div
                            key={site.id + site.status}
                            className={`dr-source dr-source--single dr-source--${
                              site.status === 'analyzed' ? 'done' : site.status === 'failed' ? 'failed' : 'analyzing'
                            }`}
                          >
                            <img className="dr-source-favicon" src={site.favicon} alt="" />
                            <div className="dr-source-meta">
                              <p className="dr-source-domain">{site.domain}</p>
                              <a className="dr-source-title" href={site.url} target="_blank" rel="noreferrer">
                                {site.title}
                              </a>
                            </div>
                            <span className="dr-source-status">{statusLabel[site.status] || site.status}</span>
                          </div>
                        ))}
                      </div>
                      <div className="dr-stats">
                        <div className="dr-stat">
                          <span className="dr-stat-value"><AnimVal value={stats.sourcesAnalyzed} /></span>
                          <span className="dr-stat-label">Sources</span>
                        </div>
                        <div className="dr-stat">
                          <span className="dr-stat-value"><AnimVal value={stats.uniqueDomains} /></span>
                          <span className="dr-stat-label">Domains</span>
                        </div>
                        <div className="dr-stat">
                          <span className="dr-stat-value"><AnimVal value={stats.iterations} /></span>
                          <span className="dr-stat-label">Iterations</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Final Report */}
                {isComplete && report && (
                  <div className="dr-card dr-msg dr-msg-agent">
                    <div className="dr-card-header">
                      <h3>{report.title}</h3>
                      <span className="dr-badge dr-badge--complete">Complete</span>
                    </div>
                    <div className="dr-card-body">
                      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 12 }}>
                        {report.summary}
                      </p>
                      <div className="dr-report-sections">
                        {report.sections.map((section) => (
                          <div key={section.id} className="dr-report-section dr-md">
                            <h4>{section.title}</h4>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {parseCitations(section.body)}
                            </ReactMarkdown>
                          </div>
                        ))}
                      </div>
                      {report.citations.length > 0 && (
                        <div className="dr-citations">
                          <h4>Sources</h4>
                          <ul className="dr-citations-list" style={{ position: 'relative' }}>
                            {(showAllSources ? report.citations : report.citations.slice(0, 3)).map((c) => (
                              <li key={c.id} id={`citation-${c.id}`} style={{scrollMarginTop: 20}}>
                                [{c.id}]{' '}
                                <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a>
                              </li>
                            ))}
                            {!showAllSources && report.citations.length > 3 && (
                              <div style={{ position: 'absolute', bottom: -5, left: 0, right: 0, height: 40, background: 'linear-gradient(transparent, var(--bg-surface))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                <button onClick={() => setShowAllSources(true)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-full)', padding: '6px 14px', fontSize: 11, cursor: 'pointer', zIndex: 2, fontFamily: 'var(--font-label)', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)'}}>
                                  Show all {report.citations.length} sources
                                </button>
                              </div>
                            )}
                          </ul>
                        </div>
                      )}
                      <div className="dr-plan-actions" style={{ marginTop: 16 }}>
                        <button className="dr-btn" onClick={exportMarkdown}>Export Markdown</button>
                        <button className="dr-btn" onClick={() => window.print()}>Export PDF</button>
                      </div>
                    </div>
                  </div>
                )}

                {chat.map((m, idx) => (
                  <div key={idx} className={m.role === 'user' ? 'dr-msg dr-msg-user' : 'dr-card dr-msg dr-msg-agent'} style={m.role === 'agent' ? { padding: '14px 16px' } : {}}>
                    {m.role === 'agent' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="dr-beta-dot" style={{ animation: 'none' }}></span>
                          <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Report Analysis</span>
                        </div>
                        <div className="dr-md">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {parseCitations(m.content)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      m.content
                    )}
                  </div>
                ))}

                {chatLoading && (
                  <ThinkingOrb title="Analyzing Report" description="Extracting intelligent answer from research architecture..." />
                )}

                {error && <p className="dr-error">{error}</p>}
              </div>

              {/* Bottom composer (follow-up) */}
              <div className="dr-composer">
                <form className="dr-composer-inner" onSubmit={submitFollowUp}>
                  <textarea
                    className="dr-composer-input"
                    value={composerValue}
                    onChange={(e) => setComposerValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitFollowUp(e as unknown as FormEvent);
                      }
                    }}
                    placeholder={isComplete ? 'Ask a follow-up question...' : 'Follow-up available when research completes'}
                    disabled={!isComplete}
                  />
                  <button className="dr-composer-send" type="submit" disabled={!isComplete || !composerValue.trim()} aria-label="Send follow-up">
                    <ArrowIcon />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* ─── Research Activity Sidebar ─── */}
        {showSidebar && !isNew && (
          <aside className="dr-sidebar">
            <div className="dr-sidebar-header">
              <h3>Research Activity</h3>
              <button className="dr-sidebar-close" onClick={() => setShowSidebar(false)}>✕</button>
            </div>
            <div className="dr-sidebar-body">
              {/* Findings */}
              {learned.length > 0 && (
                <div className="dr-sidebar-section">
                  <p className="dr-sidebar-section-title">
                    Key Findings ({learned.length})
                  </p>
                  <ul className="dr-findings">
                    {learned.slice(0, 12).map((item, i) => (
                      <li key={`${i}-${item.slice(0, 10)}`} className="dr-finding">
                        {item.length > 120 ? item.slice(0, 120) + '…' : item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Activity log */}
              <div className="dr-sidebar-section">
                <p className="dr-sidebar-section-title">
                  Activity Log
                </p>
                <ul className="dr-log">
                  {events.slice(0, 20).map((ev) => (
                    <li key={ev.id} className="dr-log-entry">
                      <span className="dr-log-time">
                        {new Date(ev.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <p className="dr-log-msg">{ev.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
