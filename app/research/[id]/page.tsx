'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import '../../home.css';

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

const phaseLabel = (phase: string) => phase.replace(/_/g, ' ');

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <li className="dr-pill">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </li>
  );
}

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
  const [showThinking, setShowThinking] = useState(true);
  const [showLearned, setShowLearned] = useState(true);
  const [showWebsites, setShowWebsites] = useState(true);
  const [composerValue, setComposerValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = id === 'new';
  const isComplete = status?.phase === 'complete';

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

  const pullStatus = async (advance = true) => {
    if (!statusEndpoint) return;
    const res = await fetch(`${statusEndpoint}&advance=${advance ? '1' : '0'}`, { cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch status');
    setStatus(data);
    setPlan(data.planFinal || data.planDraft || '');
    setPlanEdit(!data.planApproved);

    if (data.hasReport) {
      const reportRes = await fetch(`/api/research/${id}/report?session=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      if (reportRes.ok) {
        setReport(await reportRes.json());
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
      } catch {
        // Keep status route as source of truth.
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 2500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id, sessionId]);

  useEffect(() => {
    if (isNew) return;
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
  }, [isNew, status?.phase, status?.progress, liveEvents.length, liveWebsites.length, liveLearned.length, report?.title, error]);

  const startResearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const requestBody = JSON.stringify({ query, sessionId, id: id === 'new' ? undefined : id });
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
      if (!res.ok) throw new Error(data.error || 'Unable to launch deep research right now.');

      localStorage.setItem('forge-research-session', data.sessionId);
      router.replace(`/research/${data.id}?session=${encodeURIComponent(data.sessionId)}`);
    } catch (e: any) {
      setError(e.message || 'Unable to launch deep research right now.');
    } finally {
      setLoading(false);
    }
  };

  const submitStart = async (e: FormEvent) => {
    e.preventDefault();
    await startResearch();
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
    if (!composerValue.trim() || !isComplete || !id || id === 'new') return;
    setError(null);

    try {
      const res = await fetch(`/api/research/${id}/control`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'follow-up', sessionId, question: composerValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Control request failed');
      setComposerValue('');
      await pullStatus(false);
    } catch (e: any) {
      setError(e.message || 'Control request failed');
    }
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

  const printPdf = () => window.print();

  const websites = liveWebsites.length > 0 ? liveWebsites : status?.websites || [];
  const learned = liveLearned.length > 0 ? liveLearned : status?.learnedSoFar || [];
  const events = liveEvents.length > 0 ? liveEvents : status?.events || [];
  const stats = status?.stats || defaultStats;

  return (
    <div className="page dr-page">
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

      <header className="dr-topbar">
        <Link href="/" className="dr-back">Back</Link>
        <p className="dr-title">Deep Research (Beta)</p>
        <div className="dr-controls">
          {!isNew && (
            <>
              <button className="dr-control" onClick={() => control('pause')}>Pause</button>
              <button className="dr-control" onClick={() => control('resume')}>Resume</button>
              <button className="dr-control" onClick={() => control('stop')}>Stop</button>
            </>
          )}
        </div>
      </header>

      {isNew ? (
        <main className="dr-initial">
          <form className="dr-input-shell" onSubmit={submitStart}>
            <textarea
              className="dr-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void startResearch();
                }
              }}
              placeholder="What do you want to research deeply today?"
            />
            <button className="dr-send" type="submit" disabled={!query.trim() || loading} aria-label="Send research query">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 4l8 8-8 8" />
              </svg>
            </button>
          </form>
          {error && <p className="dr-error">{error}</p>}
        </main>
      ) : (
        <main className="dr-chat">
          <section className="dr-feed" ref={feedRef}>
            {status?.query && (
              <article className="dr-bubble dr-user">
                <p>{status.query}</p>
              </article>
            )}

            {!status?.planApproved && (
              <article className="dr-bubble dr-agent">
                <div className="dr-head">
                  <h2>Research Plan</h2>
                  <span className="dr-chip">Editable</span>
                </div>
                <textarea className="dr-plan" value={plan} onChange={(e) => setPlan(e.target.value)} disabled={!planEdit} />
                <div className="dr-actions">
                  <button className="dr-control" onClick={() => setPlanEdit((v) => !v)}>{planEdit ? 'Lock Edit' : 'Edit'}</button>
                  <button className="dr-control" onClick={() => control('update-plan')}>Save Plan</button>
                  <button className="dr-control dr-approve" onClick={() => control('approve-plan')}>Approve & Start</button>
                </div>
              </article>
            )}

            <article className="dr-bubble dr-agent">
              <button className="dr-fold" onClick={() => setShowThinking((v) => !v)}>
                <span className="dr-orb-wrap" aria-hidden="true">
                  <span className="dr-orb" />
                  <span className="dr-ring" />
                  <span className="dr-spark dr-spark-a" />
                  <span className="dr-spark dr-spark-b" />
                </span>
                <span>Thinking... {status ? phaseLabel(status.phase) : 'initializing'}</span>
              </button>
              {showThinking && <p className="dr-subtle">Running live query fan-out, source analysis, and synthesis across evolving evidence.</p>}
            </article>

            {status?.phase === 'query_fanout' && (
              <article className="dr-bubble dr-agent dr-typing">
                <p>Generating search queries...</p>
                <span className="dr-typing-glow" aria-hidden="true" />
              </article>
            )}

            <article className="dr-bubble dr-agent">
              <button className="dr-fold" onClick={() => setShowWebsites((v) => !v)}>
                <span>Websites being searched</span>
                <span className="dr-chip">{websites.length}</span>
              </button>
              {showWebsites && (
                <ul className="dr-sites">
                  {websites.slice(0, 24).map((site) => (
                    <li key={site.id} className={`dr-site dr-${site.status}`}>
                      <img src={site.favicon} alt="" />
                      <div>
                        <p>{site.domain}</p>
                        <a href={site.url} target="_blank" rel="noreferrer">{site.title}</a>
                      </div>
                      <span>{site.status === 'queued' ? 'searching' : site.status === 'fetching' ? 'analyzing' : site.status === 'analyzed' ? 'done' : 'failed'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="dr-bubble dr-agent">
              <button className="dr-fold" onClick={() => setShowLearned((v) => !v)}>
                <span>What the agent learned</span>
                <span className="dr-chip">{learned.length}</span>
              </button>
              {showLearned && (
                <ul className="dr-learned">
                  {learned.slice(0, 14).map((item, i) => (
                    <li key={`${i}-${item.slice(0, 12)}`}>{item}</li>
                  ))}
                </ul>
              )}
            </article>

            <article className="dr-bubble dr-agent">
              <div className="dr-head">
                <h2>Live Stats</h2>
                <span className="dr-chip">ETA {status?.etaMinutes ?? '-'}m</span>
              </div>
              <ul className="dr-pills">
                <StatPill label="Sources" value={stats.sourcesAnalyzed} />
                <StatPill label="Depth" value={stats.depthScore} />
                <StatPill label="Queries" value={stats.queriesGenerated} />
                <StatPill label="Iterations" value={stats.iterations} />
                <StatPill label="Domains" value={stats.uniqueDomains} />
                <StatPill label="Tokens" value={stats.tokensUsedEstimate} />
              </ul>
            </article>

            <article className="dr-bubble dr-agent">
              <div className="dr-head">
                <h2>Research Log</h2>
                <span className="dr-chip">Live</span>
              </div>
              <ul className="dr-log">
                {events.slice(0, 18).map((event) => (
                  <li key={event.id}>
                    <p>{event.message}</p>
                    <small>{new Date(event.at).toLocaleTimeString()} · {phaseLabel(event.phase)}</small>
                  </li>
                ))}
              </ul>
            </article>

            {isComplete && report && (
              <article className="dr-bubble dr-agent dr-report">
                <div className="dr-head">
                  <h2>{report.title}</h2>
                  <span className="dr-chip">Complete</span>
                </div>
                <p className="dr-subtle">{report.summary}</p>
                <div className="dr-sections">
                  {report.sections.map((section) => (
                    <section key={section.id}>
                      <h3>{section.title}</h3>
                      <p>{section.body}</p>
                    </section>
                  ))}
                </div>
                <div className="dr-citations">
                  <h3>Sources</h3>
                  <ul>
                    {report.citations.map((c) => (
                      <li key={c.id}>
                        <span>[{c.id}] </span>
                        <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="dr-actions">
                  <button className="dr-control" onClick={exportMarkdown}>Export Markdown</button>
                  <button className="dr-control" onClick={printPdf}>Export PDF</button>
                </div>
              </article>
            )}
            {error && <p className="dr-error">{error}</p>}
          </section>

          <form className="dr-composer" onSubmit={submitFollowUp}>
            <textarea
              className="dr-composer-input"
              value={composerValue}
              onChange={(e) => setComposerValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submitFollowUp(e as unknown as FormEvent);
                }
              }}
              placeholder={isComplete ? 'Ask follow-up...' : 'Follow-up unlocks when report completes.'}
              disabled={!isComplete}
            />
            <button className="dr-send" type="submit" disabled={!isComplete || !composerValue.trim()} aria-label="Send follow up">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 4l8 8-8 8" />
              </svg>
            </button>
          </form>
        </main>
      )}

      <footer className="footer">
        <p className="footer-copy">© 2026 FORGE DIGITAL. ALL RIGHTS RESERVED.</p>
        <div className="footer-links">
          <Link href="/privacy" className="footer-link">Privacy</Link>
          <Link href="/terms" className="footer-link">Terms</Link>
          <Link href="/contact" className="footer-link">Contact</Link>
          <a href="https://twitter.com/jip7e" target="_blank" rel="noopener noreferrer" className="footer-link">Twitter / X</a>
        </div>
      </footer>

      <style jsx>{`
        .dr-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: #0e0c09;
          color: #f0e6d3;
          display: grid;
          grid-template-rows: auto auto 1fr auto;
        }

        .dr-topbar {
          border-top: 1px solid #2c251d;
          border-bottom: 1px solid #2c251d;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          backdrop-filter: blur(14px) saturate(150%);
          background: rgba(14, 12, 9, 0.84);
        }

        .dr-back,
        .dr-control,
        .dr-chip,
        .dr-fold,
        .dr-title {
          font-family: var(--font-label);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .dr-back {
          justify-self: start;
          border: 1px solid #3d3328;
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 10px;
          color: #a89278;
        }

        .dr-title {
          margin: 0;
          font-size: 11px;
          color: #a89278;
        }

        .dr-controls {
          justify-self: end;
          display: inline-flex;
          gap: 6px;
        }

        .dr-control {
          border: 1px solid #3d3328;
          color: #a89278;
          background: transparent;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 9px;
          cursor: pointer;
        }

        .dr-approve {
          color: #0e0c09;
          background: #f0e6d3;
          border-color: transparent;
          box-shadow: 0 0 20px rgba(240, 230, 211, 0.2);
        }

        .dr-initial {
          min-height: calc(100dvh - 68px - 58px - 74px);
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .dr-input-shell {
          width: min(900px, 100%);
          position: relative;
        }

        .dr-input,
        .dr-composer-input,
        .dr-plan {
          width: 100%;
          border: 1px solid #3d3328;
          border-radius: 24px;
          background: #181410;
          color: #f0e6d3;
          padding: 18px 58px 18px 18px;
          resize: vertical;
          font-size: 18px;
          line-height: 1.45;
        }

        .dr-input:focus,
        .dr-composer-input:focus,
        .dr-plan:focus {
          outline: none;
          border-color: #4e4336;
          box-shadow: 0 0 0 3px rgba(240, 230, 211, 0.06), 0 0 24px rgba(240, 230, 211, 0.1);
        }

        .dr-input {
          min-height: 150px;
        }

        .dr-send {
          position: absolute;
          right: 12px;
          bottom: 12px;
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid #4e4336;
          background: #f0e6d3;
          color: #0e0c09;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .dr-send svg {
          width: 14px;
          height: 14px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .dr-send:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .dr-chat {
          min-height: 0;
          display: grid;
          grid-template-rows: 1fr auto;
          animation: drDock 0.34s var(--ease-spring) both;
        }

        .dr-feed {
          width: min(980px, calc(100vw - 28px));
          margin: 0 auto;
          min-height: 0;
          overflow-y: auto;
          padding: 14px 6px 20px;
          display: grid;
          gap: 11px;
          scroll-behavior: smooth;
        }

        .dr-bubble {
          border: 1px solid #2c251d;
          border-radius: 16px;
          background: #181410;
          padding: 12px 14px;
          animation: drMsg 0.26s var(--ease-spring) both;
        }

        .dr-user {
          margin-left: auto;
          max-width: 74%;
          background: #f0e6d3;
          color: #0e0c09;
          border-color: transparent;
          border-bottom-right-radius: 8px;
        }

        .dr-agent {
          margin-right: auto;
          width: min(90%, 860px);
          border-bottom-left-radius: 8px;
        }

        .dr-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .dr-head h2 {
          margin: 0;
          font-family: var(--font-headline);
          font-size: 22px;
        }

        .dr-chip {
          border: 1px solid #3d3328;
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 9px;
          color: #a89278;
        }

        .dr-plan {
          min-height: 126px;
          padding: 12px;
          font-size: 14px;
        }

        .dr-actions {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .dr-fold {
          border: 0;
          background: transparent;
          color: #f0e6d3;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
          font-size: 11px;
          cursor: pointer;
        }

        .dr-orb-wrap {
          width: 22px;
          height: 22px;
          position: relative;
          display: inline-block;
          margin-right: 6px;
        }

        .dr-orb {
          position: absolute;
          inset: 5px;
          border-radius: 999px;
          background: radial-gradient(circle, #f0e6d3 0%, #a89278 74%);
          box-shadow: 0 0 14px rgba(240, 230, 211, 0.18);
          animation: drPulse 1.8s var(--ease-smooth) infinite;
        }

        .dr-ring {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          border: 1px solid #4e4336;
          animation: drRing 2.2s var(--ease-smooth) infinite;
        }

        .dr-spark {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 999px;
          background: #f0e6d3;
          animation: drSpark 1.5s ease-in-out infinite;
        }

        .dr-spark-a { top: 2px; right: 1px; }
        .dr-spark-b { bottom: 1px; left: 1px; animation-delay: 0.4s; }

        .dr-subtle {
          margin-top: 8px;
          font-size: 14px;
          line-height: 1.6;
          color: #a89278;
        }

        .dr-typing {
          position: relative;
          overflow: hidden;
        }

        .dr-typing p {
          margin: 0;
          position: relative;
          z-index: 1;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          font-family: var(--font-label);
        }

        .dr-typing-glow {
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 12%, rgba(240, 230, 211, 0.09) 45%, transparent 70%);
          animation: drTyping 1.6s linear infinite;
        }

        .dr-sites,
        .dr-learned,
        .dr-pills,
        .dr-log,
        .dr-citations ul,
        .dr-sections {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .dr-sites {
          margin-top: 10px;
          display: grid;
          gap: 8px;
        }

        .dr-site {
          border: 1px solid #2c251d;
          border-radius: 11px;
          display: grid;
          grid-template-columns: 20px 1fr auto;
          gap: 8px;
          align-items: center;
          padding: 8px;
          background: #0f0d0a;
        }

        .dr-site img {
          width: 18px;
          height: 18px;
          border-radius: 3px;
        }

        .dr-site p {
          margin: 0;
          font-size: 10px;
          font-family: var(--font-label);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #a89278;
        }

        .dr-site a {
          font-size: 13px;
          color: #f0e6d3;
          display: inline-block;
          margin-top: 2px;
        }

        .dr-site span {
          font-size: 9px;
          border-radius: 999px;
          border: 1px solid #3d3328;
          padding: 4px 7px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-family: var(--font-label);
        }

        .dr-analyzed span { color: #34d399; border-color: #34d399; }
        .dr-fetching span,
        .dr-queued span { color: #fcd34d; border-color: #fcd34d; }
        .dr-failed span { color: #f87171; border-color: #f87171; }

        .dr-learned {
          margin-top: 10px;
          display: grid;
          gap: 7px;
        }

        .dr-learned li {
          border-left: 2px solid #3d3328;
          padding-left: 8px;
          color: #a89278;
          font-size: 13px;
          line-height: 1.6;
          animation: drFade 0.24s var(--ease-out);
        }

        .dr-pills {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .dr-pill {
          border: 1px solid #3d3328;
          border-radius: 999px;
          padding: 6px 10px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #0f0d0a;
        }

        .dr-pill span {
          font-size: 9px;
          color: #a89278;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          font-family: var(--font-label);
        }

        .dr-pill strong {
          font-size: 15px;
          font-family: var(--font-headline);
        }

        .dr-log {
          margin-top: 10px;
          display: grid;
          gap: 7px;
        }

        .dr-log li {
          border-left: 2px solid #3d3328;
          padding-left: 8px;
        }

        .dr-log p {
          margin: 0;
          font-size: 13px;
          line-height: 1.55;
        }

        .dr-log small {
          color: #a89278;
          font-size: 11px;
        }

        .dr-sections {
          margin-top: 10px;
          display: grid;
          gap: 10px;
        }

        .dr-sections section {
          border: 1px solid #2c251d;
          border-radius: 12px;
          background: #0f0d0a;
          padding: 11px;
        }

        .dr-sections h3 {
          margin: 0 0 6px;
          font-family: var(--font-headline);
          font-size: 18px;
        }

        .dr-sections p {
          margin: 0;
          white-space: pre-wrap;
          font-size: 13px;
          line-height: 1.65;
        }

        .dr-citations {
          margin-top: 10px;
        }

        .dr-citations h3 {
          margin: 0 0 6px;
          font-family: var(--font-headline);
          font-size: 18px;
        }

        .dr-citations ul {
          display: grid;
          gap: 4px;
        }

        .dr-citations li {
          font-size: 12px;
          line-height: 1.5;
        }

        .dr-composer {
          width: min(980px, calc(100vw - 28px));
          margin: 0 auto;
          position: sticky;
          bottom: 0;
          padding: 8px 6px 14px;
          background: linear-gradient(180deg, transparent 0%, rgba(14, 12, 9, 0.5) 38%, #0e0c09 100%);
        }

        .dr-composer-input {
          min-height: 56px;
          max-height: 180px;
          font-size: 14px;
          border-radius: 18px;
          padding: 12px 54px 12px 12px;
        }

        .dr-composer .dr-send {
          right: 18px;
          bottom: 20px;
        }

        .dr-error {
          color: #f87171;
          font-size: 12px;
          margin: 6px 0 0;
        }

        :global(.dr-page .footer) {
          margin-top: 22px;
          position: relative;
          z-index: 2;
        }

        @keyframes drMsg {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes drDock {
          from { opacity: 0.92; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes drPulse {
          0% { transform: scale(0.9); opacity: 0.7; }
          50% { transform: scale(1.16); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.7; }
        }

        @keyframes drRing {
          0% { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1.25); opacity: 0; }
        }

        @keyframes drSpark {
          0%, 100% { opacity: 0.22; transform: scale(0.75); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        @keyframes drTyping {
          from { transform: translateX(-56%); }
          to { transform: translateX(64%); }
        }

        @keyframes drFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 880px) {
          .dr-page {
            grid-template-rows: auto auto 1fr auto;
          }

          .dr-topbar {
            grid-template-columns: auto 1fr;
            padding: 12px;
            height: auto;
          }

          .dr-title {
            justify-self: start;
            margin-left: 4px;
          }

          .dr-controls {
            grid-column: 1 / -1;
            justify-self: start;
          }

          .dr-input-shell,
          .dr-feed,
          .dr-composer {
            width: min(100%, calc(100vw - 16px));
          }

          .dr-user,
          .dr-agent {
            width: 100%;
            max-width: 100%;
          }

          .dr-site {
            grid-template-columns: 20px 1fr;
          }

          .dr-site span {
            grid-column: 1 / -1;
            justify-self: start;
          }

          .dr-composer .dr-send {
            right: 14px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dr-bubble,
          .dr-orb,
          .dr-ring,
          .dr-spark,
          .dr-typing-glow,
          .dr-learned li {
            animation: none !important;
          }

          .dr-feed {
            scroll-behavior: auto;
          }
        }
      `}</style>
    </div>
  );
}
