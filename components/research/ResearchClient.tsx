'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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

const statusLabel: Record<ResearchWebsite['status'], string> = {
  queued: 'Searching',
  fetching: 'Analyzing',
  analyzed: 'Done',
  failed: 'Failed',
};

const labelizePhase = (phase: string) => phase.replace(/_/g, ' ');

function AnimatedMetric({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (display === value) return;

    const startValue = display;
    const endValue = value;
    const startTime = performance.now();
    const duration = 380;
    let frame = 0;

    const tick = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue + (endValue - startValue) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [display, value]);

  return <strong>{display.toLocaleString()}</strong>;
}

export default function ResearchClient({ researchId }: { researchId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feedRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [composerInput, setComposerInput] = useState('');
  const [planMode, setPlanMode] = useState<'view' | 'edit'>('edit');
  const [showThinking, setShowThinking] = useState(true);
  const [showLearned, setShowLearned] = useState(true);
  const [showWebsites, setShowWebsites] = useState(true);
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
      const reportRes = await fetch(`/api/research/${researchId}/report?session=${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
      });
      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport(reportData);
      }
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
    const interval = setInterval(tick, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [statusEndpoint]);

  useEffect(() => {
    if (!researchId || researchId === 'new') return;

    let active = true;
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/research/${researchId}/events?session=${encodeURIComponent(sessionId)}&limit=80`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || !active) return;

        setLiveEvents(data.events || []);
        setLiveWebsites(data.websites || []);
        setLiveLearned(data.learnedSoFar || []);
      } catch {
        // Status polling remains the source of truth.
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [researchId, sessionId]);

  useEffect(() => {
    if (!status) return;
    setPlanMode(status.planApproved ? 'view' : 'edit');
  }, [status?.planApproved]);

  useEffect(() => {
    if (researchId === 'new') return;
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
  }, [researchId, status?.phase, status?.progress, liveEvents.length, liveWebsites.length, liveLearned.length, report?.generatedAt, error]);

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

  const control = async (action: 'pause' | 'resume' | 'stop' | 'approve-plan' | 'update-plan') => {
    if (!researchId || researchId === 'new') return;
    setError(null);
    try {
      const payload: Record<string, string> = { action, sessionId };
      if (action === 'approve-plan' || action === 'update-plan') payload.plan = plan;

      const res = await fetch(`/api/research/${researchId}/control`, {
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

  const submitFollowUp = async () => {
    if (!composerInput.trim() || status?.phase !== 'complete' || !researchId || researchId === 'new') return;
    setError(null);

    try {
      const res = await fetch(`/api/research/${researchId}/control`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'follow-up',
          sessionId,
          question: composerInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Control request failed');

      setComposerInput('');
      await pullStatus(false);
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
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `deep-research-${researchId}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => window.print();

  const submitStart = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || loading) return;
    startResearch();
  };

  const isNew = researchId === 'new';
  const isComplete = status?.phase === 'complete';
  const websites = liveWebsites.length > 0 ? liveWebsites : status?.websites || [];
  const learned = liveLearned.length > 0 ? liveLearned : status?.learnedSoFar || [];
  const events = liveEvents.length > 0 ? liveEvents : status?.events || [];
  const stats = status?.stats || defaultStats;

  return (
    <div className={`research-page research-shell ${isNew ? 'research-shell-start' : ''}`}>
      <div className="research-ambient" aria-hidden="true">
        <span className="research-ambient-orb research-ambient-orb-1" />
        <span className="research-ambient-orb research-ambient-orb-2" />
        <span className="research-ambient-orb research-ambient-orb-3" />
      </div>

      <nav className="nav">
        <Link href="/" className="nav-logo">FORGE</Link>
        <div className="nav-links">
          <Link href="/#how" className="nav-link">How it works</Link>
          <Link href="/#gallery" className="nav-link">Gallery</Link>
          <Link href="/changelog" className="nav-link">Changelog</Link>
          <Link href="/pricing" className="nav-link">Pricing</Link>
        </div>
        <div className="nav-right">
          <ThemeToggle />
          <Link href="/build" className="nav-cta">Inquire</Link>
        </div>
      </nav>

      <header className="research-topbar">
        <Link href="/" className="research-back">Back</Link>
        <span className="research-beta">Deep Research (Beta)</span>
        <div className="research-topbar-actions">
          {!isNew && (
            <>
              <button className="research-ctrl" onClick={() => control('pause')}>Pause</button>
              <button className="research-ctrl" onClick={() => control('resume')}>Resume</button>
              <button className="research-ctrl" onClick={() => control('stop')}>Stop</button>
            </>
          )}
        </div>
      </header>

      {isNew ? (
        <main className="research-start-stage">
          <form className="research-start-input-wrap" onSubmit={submitStart}>
            <textarea
              className="research-start-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitStart();
                }
              }}
              placeholder="What do you want to research deeply today?"
            />
            <button className="research-send-icon" type="submit" disabled={!query.trim() || loading} aria-label="Send research query">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 4l8 8-8 8" />
              </svg>
            </button>
            {error && <p className="research-inline-error">{error}</p>}
          </form>
        </main>
      ) : (
        <main className="research-chat-stage">
          <section className="research-feed" ref={feedRef}>
            {status?.query && (
              <article className="research-bubble research-bubble-user">
                <p>{status.query}</p>
              </article>
            )}

            {!status?.planApproved && (
              <article className="research-bubble research-bubble-agent">
                <div className="research-bubble-head">
                  <h2>Research Plan</h2>
                  <span className="research-pill">Editable</span>
                </div>
                <textarea
                  className="research-plan-input"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  disabled={planMode === 'view'}
                />
                <div className="research-plan-actions">
                  <button className="research-ctrl" onClick={() => setPlanMode((v) => (v === 'edit' ? 'view' : 'edit'))}>
                    {planMode === 'edit' ? 'Lock Edit' : 'Edit'}
                  </button>
                  <button className="research-ctrl" onClick={() => control('update-plan')}>Save Plan</button>
                  <button className="research-ctrl research-ctrl-primary" onClick={() => control('approve-plan')}>
                    Approve & Start
                  </button>
                </div>
              </article>
            )}

            <article className="research-bubble research-bubble-agent">
              <button className="research-fold" onClick={() => setShowThinking((v) => !v)}>
                <span className="research-thinking-orb-wrap" aria-hidden="true">
                  <span className="research-thinking-orb" />
                  <span className="research-thinking-ring" />
                  <span className="research-thinking-spark research-thinking-spark-a" />
                  <span className="research-thinking-spark research-thinking-spark-b" />
                </span>
                <span>Thinking... {status ? labelizePhase(status.phase) : 'initializing'}</span>
              </button>
              {showThinking && (
                <p className="research-subtle">
                  Generating search queries, branching evidence paths, and synthesizing live findings as sources stream in.
                </p>
              )}
            </article>

            {status?.phase === 'query_fanout' && (
              <article className="research-bubble research-bubble-agent research-typing-bubble">
                <p>Generating search queries...</p>
                <span className="research-typing-glow" aria-hidden="true" />
              </article>
            )}

            <article className="research-bubble research-bubble-agent">
              <button className="research-fold" onClick={() => setShowWebsites((v) => !v)}>
                <span>Websites being searched</span>
                <span className="research-pill">{websites.length}</span>
              </button>
              {showWebsites && (
                <ul className="research-source-list">
                  {websites.slice(0, 24).map((site) => (
                    <li key={site.id} className={`research-source research-source-${site.status}`}>
                      <img src={site.favicon} alt="" className="research-source-favicon" />
                      <div>
                        <p className="research-source-domain">{site.domain}</p>
                        <a href={site.url} target="_blank" rel="noreferrer" className="research-source-title">{site.title}</a>
                      </div>
                      <span className="research-source-status">{statusLabel[site.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="research-bubble research-bubble-agent">
              <button className="research-fold" onClick={() => setShowLearned((v) => !v)}>
                <span>What the agent learned</span>
                <span className="research-pill">{learned.length}</span>
              </button>
              {showLearned && (
                <ul className="research-learned-list">
                  {learned.slice(0, 14).map((item, idx) => (
                    <li key={`${idx}-${item.slice(0, 15)}`}>{item}</li>
                  ))}
                </ul>
              )}
            </article>

            <article className="research-bubble research-bubble-agent">
              <div className="research-bubble-head">
                <h2>Live Stats</h2>
                <span className="research-pill">ETA {status?.etaMinutes ?? '-'}m</span>
              </div>
              <ul className="research-stat-pills">
                <li><span>Sources</span><AnimatedMetric value={stats.sourcesAnalyzed} /></li>
                <li><span>Depth</span><AnimatedMetric value={stats.depthScore} /></li>
                <li><span>Queries</span><AnimatedMetric value={stats.queriesGenerated} /></li>
                <li><span>Iterations</span><AnimatedMetric value={stats.iterations} /></li>
                <li><span>Domains</span><AnimatedMetric value={stats.uniqueDomains} /></li>
                <li><span>Tokens</span><AnimatedMetric value={stats.tokensUsedEstimate} /></li>
              </ul>
            </article>

            <article className="research-bubble research-bubble-agent">
              <div className="research-bubble-head">
                <h2>Research Log</h2>
                <span className="research-pill">Live</span>
              </div>
              <ul className="research-log-list">
                {events.slice(0, 18).map((event) => (
                  <li key={event.id}>
                    <p>{event.message}</p>
                    <small>{new Date(event.at).toLocaleTimeString()} · {labelizePhase(event.phase)}</small>
                  </li>
                ))}
              </ul>
            </article>

            {isComplete && report && (
              <article className="research-bubble research-bubble-agent research-report">
                <div className="research-bubble-head">
                  <h2>{report.title}</h2>
                  <span className="research-pill">Complete</span>
                </div>
                <p className="research-subtle">{report.summary}</p>

                <div className="research-report-sections">
                  {report.sections.map((section) => (
                    <section key={section.id} className="research-report-section">
                      <h3>{section.title}</h3>
                      <p>{section.body}</p>
                    </section>
                  ))}
                </div>

                <div className="research-report-citations">
                  <h3>Sources</h3>
                  <ul>
                    {report.citations.map((citation) => (
                      <li key={citation.id}>
                        <span>[{citation.id}] </span>
                        <a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="research-plan-actions">
                  <button className="research-ctrl" onClick={exportMarkdown}>Export Markdown</button>
                  <button className="research-ctrl" onClick={printPdf}>Export PDF</button>
                </div>
              </article>
            )}

            {error && <p className="research-inline-error">{error}</p>}
            {!status && <p className="research-inline-note">Loading research status...</p>}
          </section>

          <form
            className="research-composer"
            onSubmit={(e) => {
              e.preventDefault();
              submitFollowUp();
            }}
          >
            <textarea
              className="research-composer-input"
              value={composerInput}
              onChange={(e) => setComposerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitFollowUp();
                }
              }}
              placeholder={isComplete ? 'Ask follow-up...' : 'Follow-up unlocks when this report completes.'}
              disabled={!isComplete}
            />
            <button className="research-send-icon" type="submit" disabled={!isComplete || !composerInput.trim()} aria-label="Send follow up">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 4l8 8-8 8" />
              </svg>
            </button>
          </form>
        </main>
      )}
    </div>
  );
}
