'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';

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
  snippet?: string;
  favicon: string;
  checkedAt?: string;
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
  markdown: string;
  generatedAt: string;
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
  control: { paused: boolean; stopped: boolean };
  websites: ResearchWebsite[];
  learnedSoFar: string[];
  events: ResearchEvent[];
  hasReport: boolean;
  completedAt?: string;
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

export default function ResearchClient({ researchId }: { researchId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLearned, setShowLearned] = useState(true);
  const [followUp, setFollowUp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<ResearchEvent[]>([]);
  const [liveWebsites, setLiveWebsites] = useState<ResearchWebsite[]>([]);
  const [liveLearned, setLiveLearned] = useState<string[]>([]);

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
    if (!researchId || researchId === 'new') return '';
    return `/api/research/${researchId}/status?session=${encodeURIComponent(sessionId)}`;
  }, [researchId, sessionId]);

  const pullStatus = async (advance = true) => {
    if (!statusEndpoint) return;
    const res = await fetch(`${statusEndpoint}&advance=${advance ? '1' : '0'}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch status');
    setStatus(data);
    setPlan(data.planFinal || data.planDraft || '');

    if (data.hasReport) {
      const reportRes = await fetch(`/api/research/${researchId}/report?session=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport(reportData);
      }
    }
  };

  useEffect(() => {
    if (!statusEndpoint) return;

    let isMounted = true;
    const tick = async () => {
      try {
        if (isMounted) await pullStatus(true);
      } catch (e: any) {
        if (isMounted) setError(e.message || 'Status polling failed');
      }
    };

    tick();
    const interval = setInterval(tick, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [statusEndpoint]);

  useEffect(() => {
    if (!researchId || researchId === 'new') return;
    let isMounted = true;

    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/research/${researchId}/events?session=${encodeURIComponent(sessionId)}&limit=80`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) return;
        if (!isMounted) return;
        setLiveEvents(data.events || []);
        setLiveWebsites(data.websites || []);
        setLiveLearned(data.learnedSoFar || []);
      } catch {
        // Best-effort feed; status route remains source of truth.
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [researchId, sessionId]);

  const startResearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const requestBody = JSON.stringify({ query, sessionId, id: researchId === 'new' ? undefined : researchId });

      let res = await fetch('/api/research/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestBody,
      });

      if (!res.ok) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        res = await fetch('/api/research/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: requestBody,
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to launch deep research right now. Please try again.');

      localStorage.setItem('forge-research-session', data.sessionId);
      router.replace(`/research/${data.id}?session=${encodeURIComponent(data.sessionId)}`);
    } catch (e: any) {
      setError(e.message || 'Unable to launch deep research right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const control = async (action: 'pause' | 'resume' | 'stop' | 'approve-plan' | 'update-plan' | 'follow-up') => {
    if (!researchId || researchId === 'new') return;
    setError(null);
    try {
      const payload: Record<string, string> = { action, sessionId };
      if (action === 'approve-plan' || action === 'update-plan') payload.plan = plan;
      if (action === 'follow-up') payload.question = followUp;

      const res = await fetch(`/api/research/${researchId}/control`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Control request failed');

      await pullStatus(false);
      if (action === 'follow-up') setFollowUp('');
    } catch (e: any) {
      setError(e.message || 'Control request failed');
    }
  };

  const exportMarkdown = async () => {
    if (!researchId || researchId === 'new') return;
    const res = await fetch(`/api/research/${researchId}/report?session=${encodeURIComponent(sessionId)}&format=md`);
    if (!res.ok) return;
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deep-research-${researchId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => window.print();

  const isNew = researchId === 'new';
  const isComplete = status?.phase === 'complete';
  const phaseLabel = (status?.phase || 'awaiting_plan').replace(/_/g, ' ');

  return (
    <div className={`research-page ${isNew ? 'research-page-start' : ''}`}>
      <nav className="nav">
        <Link href="/" className="nav-logo">FORGE</Link>
        <div className="nav-links">
          <Link href="/#how" className="nav-link">How it works</Link>
          <Link href="/#gallery" className="nav-link">Gallery</Link>
          <Link href="/changelog" className="nav-link">Changelog</Link>
        </div>
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <ThemeToggle />
          <Link href="/build" className="nav-cta">Inquire</Link>
        </div>
      </nav>

      <section className="research-hero">
        <span className="research-eyebrow">Deep Research / Beta</span>
        <h1 className="research-title">Deep Research Agent</h1>
        <p className="research-subtitle">
          A dedicated long-form research companion with transparent progress, live source analysis, and citable synthesis.
        </p>

        {isNew ? (
          <div className="research-start-card">
            <label className="research-label">Research query</label>
            <textarea
              className="research-query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Example: Analyze the latest AI coding copilots for startup engineering teams in 2026, with cost, quality, latency, and reliability tradeoffs."
            />
            <button className="btn-primary research-launch-btn" onClick={startResearch} disabled={!query.trim() || loading}>
              {loading ? 'Launching...' : 'Launch Deep Research'}
            </button>
          </div>
        ) : (
          <div className="research-thinking">
            <div className="research-orb" />
            <div>
              <p className="research-thinking-title">Thinking...</p>
              <p className="research-thinking-sub">Phase: {phaseLabel}</p>
            </div>
          </div>
        )}
      </section>

      {!isNew && (
        <main className="research-body">
          <section className="research-left">
            <article className="research-panel">
              <div className="research-panel-head">
                <h2>Research Plan</h2>
                <span className="research-chip">Editable</span>
              </div>
              <textarea
                className="research-plan-input"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                disabled={Boolean(status?.planApproved)}
              />
              <div className="research-actions-row">
                <button className="btn-ghost" onClick={() => control('update-plan')} disabled={Boolean(status?.planApproved)}>Update Plan</button>
                <button className="btn-primary" onClick={() => control('approve-plan')} disabled={Boolean(status?.planApproved)}>Approve & Run</button>
              </div>
            </article>

            <article className="research-panel">
              <div className="research-panel-head">
                <h2>Timeline</h2>
                <span className="research-chip">Live</span>
              </div>
              <ul className="research-timeline">
                {(liveEvents.length > 0 ? liveEvents : status?.events || []).slice(0, 10).map((ev) => (
                  <li key={ev.id} className="research-timeline-item">
                    <span className="research-timeline-dot" />
                    <div>
                      <p className="research-event-message">{ev.message}</p>
                      <p className="research-event-meta">{new Date(ev.at).toLocaleTimeString()} · {ev.phase.replace(/_/g, ' ')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className="research-panel">
              <div className="research-panel-head">
                <h2>Websites Browsed</h2>
                <span className="research-chip">{status?.websites?.length || 0}</span>
              </div>
              <ul className="research-sites">
                {(liveWebsites.length > 0 ? liveWebsites : status?.websites || []).slice(0, 18).map((site) => (
                  <li key={site.id} className={`research-site research-site-${site.status}`}>
                    <img src={site.favicon} alt="" className="research-site-favicon" />
                    <div className="research-site-meta">
                      <p className="research-site-domain">{site.domain}</p>
                      <a href={site.url} target="_blank" rel="noreferrer" className="research-site-title">{site.title}</a>
                    </div>
                    <div className="research-site-status">
                      {site.status === 'analyzed' ? '✓' : site.status === 'fetching' ? '...' : site.status === 'failed' ? '!' : '·'}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="research-right">
            <article className="research-panel">
              <div className="research-panel-head">
                <h2>Progress & Live Stats</h2>
                <span className="research-chip">ETA {status?.etaMinutes ?? '-'}m</span>
              </div>
              <div className="research-progress-track">
                <div className="research-progress-fill" style={{ width: `${status?.progress || 0}%` }} />
              </div>
              <div className="research-stats-grid">
                <div><span>Sources analyzed</span><strong>{status?.stats?.sourcesAnalyzed ?? 0}</strong></div>
                <div><span>Tokens used</span><strong>{status?.stats?.tokensUsedEstimate ?? 0}</strong></div>
                <div><span>Depth score</span><strong>{status?.stats?.depthScore ?? 0}</strong></div>
                <div><span>Queries generated</span><strong>{status?.stats?.queriesGenerated ?? 0}</strong></div>
                <div><span>Iterations</span><strong>{status?.stats?.iterations ?? 0}</strong></div>
                <div><span>Unique domains</span><strong>{status?.stats?.uniqueDomains ?? 0}</strong></div>
              </div>
              <div className="research-actions-row">
                <button className="btn-ghost" onClick={() => control('pause')}>Pause</button>
                <button className="btn-ghost" onClick={() => control('resume')}>Resume</button>
                <button className="btn-ghost" onClick={() => control('stop')}>Stop</button>
              </div>
            </article>

            <article className="research-panel">
              <button className="research-learned-toggle" onClick={() => setShowLearned((v) => !v)}>
                <span>What the agent learned so far</span>
                <span>{showLearned ? '−' : '+'}</span>
              </button>
              {showLearned && (
                <ul className="research-learned-list">
                  {(liveLearned.length > 0 ? liveLearned : status?.learnedSoFar || []).slice(0, 12).map((item, idx) => (
                    <li key={`${idx}-${item.slice(0, 10)}`}>{item}</li>
                  ))}
                </ul>
              )}
            </article>

            {isComplete && report && (
              <article className="research-panel research-report">
                <div className="research-panel-head">
                  <h2>{report.title}</h2>
                  <span className="research-chip">Complete</span>
                </div>
                <p className="research-report-summary">{report.summary}</p>
                <div className="research-report-sections">
                  {report.sections.map((section) => (
                    <section key={section.id} className="research-report-section">
                      <h3>{section.title}</h3>
                      <p>{section.body}</p>
                    </section>
                  ))}
                </div>

                <div className="research-citations">
                  <h3>Citations</h3>
                  <ul>
                    {report.citations.map((c) => (
                      <li key={c.id}>
                        <span>[{c.id}] </span>
                        <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="research-actions-row">
                  <button className="btn-ghost" onClick={exportMarkdown}>Export Markdown</button>
                  <button className="btn-ghost" onClick={printPdf}>Export PDF</button>
                </div>

                <div className="research-follow-up">
                  <label className="research-label">Ask follow-up</label>
                  <textarea
                    className="research-query-input"
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder="Ask a deeper follow-up question..."
                  />
                  <button className="btn-primary" onClick={() => control('follow-up')} disabled={!followUp.trim()}>
                    Run Follow-up
                  </button>
                </div>
              </article>
            )}
          </section>
        </main>
      )}

      {error && <p className="research-error">{error}</p>}
      {!status && !isNew && <p className="research-loading">Loading research status...</p>}

      <footer className="footer">
        <p className="footer-copy">© 2026 FORGE DIGITAL. ALL RIGHTS RESERVED.</p>
        <div className="footer-links">
          <Link href="/privacy" className="footer-link">Privacy</Link>
          <Link href="/terms" className="footer-link">Terms</Link>
          <Link href="/changelog" className="footer-link">Changelog</Link>
          <a href="https://twitter.com/jip7e" target="_blank" rel="noopener noreferrer" className="footer-link">Twitter / X</a>
        </div>
      </footer>
    </div>
  );
}
