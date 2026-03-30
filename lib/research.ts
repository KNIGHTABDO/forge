import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile as githubReadFile, writeFile as githubWriteFile } from '@/lib/github';
import { RESEARCHER_SYSTEM_PROMPT } from '@/lib/system-prompt';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

export type ResearchPhase =
  | 'awaiting_plan'
  | 'query_fanout'
  | 'analyzing'
  | 'synthesizing'
  | 'complete'
  | 'paused'
  | 'stopped'
  | 'error';

export interface ResearchWebsite {
  id: string;
  url: string;
  domain: string;
  title: string;
  status: 'queued' | 'fetching' | 'analyzed' | 'failed';
  snippet?: string;
  favicon: string;
  checkedAt?: string;
}

export interface ResearchCitation {
  id: number;
  url: string;
  domain: string;
  title: string;
}

export interface ResearchNote {
  citationId: number;
  summary: string;
  quote?: string;
}

export interface ResearchEvent {
  id: string;
  at: string;
  phase: ResearchPhase;
  message: string;
}

export interface ResearchReportSection {
  id: string;
  title: string;
  body: string;
}

export interface ResearchReport {
  title: string;
  summary: string;
  sections: ResearchReportSection[];
  citations: ResearchCitation[];
  markdown: string;
  generatedAt: string;
}

export interface ResearchStats {
  sourcesAnalyzed: number;
  tokensUsedEstimate: number;
  depthScore: number;
  queriesGenerated: number;
  iterations: number;
  uniqueDomains: number;
}

export interface ResearchControl {
  paused: boolean;
  stopped: boolean;
}

export interface ResearchState {
  id: string;
  sessionId: string;
  query: string;
  createdAt: string;
  updatedAt: string;
  lastAdvancedAt: string;
  completedAt?: string;
  phase: ResearchPhase;
  progress: number;
  etaMinutes: number;
  planDraft: string;
  planFinal?: string;
  planApproved: boolean;
  pendingQueries: string[];
  processedQueries: string[];
  websites: ResearchWebsite[];
  citations: ResearchCitation[];
  notes: ResearchNote[];
  events: ResearchEvent[];
  learnedSoFar: string[];
  stats: ResearchStats;
  control: ResearchControl;
  report?: ResearchReport;
  chat?: { role: 'user' | 'agent'; content: string }[];
  error?: string;
}

const TARGET_SOURCES = 300;
const LOCAL_STORE_ROOT = '/tmp/forge-research-store';
let _githubSaveLock = false;
let _githubSaveIteration = 0;

function nowISO() {
  return new Date().toISOString();
}

function researchStatePath(sessionId: string, researchId: string) {
  return `sessions/${sessionId}/research/${researchId}/state.json`;
}

function researchIndexPath(researchId: string) {
  return `sessions/research-index/${researchId}.json`;
}

function localStatePath(sessionId: string, researchId: string) {
  return join(LOCAL_STORE_ROOT, 'sessions', sessionId, 'research', researchId, 'state.json');
}

function localIndexPath(researchId: string) {
  return join(LOCAL_STORE_ROOT, 'index', `${researchId}.json`);
}

function compact<T>(items: T[]): T[] {
  return items.filter(Boolean);
}

function domainFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown.site';
  }
}

function faviconFor(url: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainFor(url))}&sz=64`;
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(stripHtml(match[1])).slice(0, 140) : '';
}

function extractDescription(html: string) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  return match ? decodeEntities(stripHtml(match[1])).slice(0, 220) : '';
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const clean = raw.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    try {
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match) return JSON.parse(match[1]) as T;
    } catch {
      return null;
    }
    return null;
  }
}

async function writeLocal(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf-8');
}

async function readLocal(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

async function searchDuckDuckGo(query: string): Promise<string[]> {
  try {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'content-type': 'application/x-www-form-urlencoded',
        'accept': 'text/html',
        'referer': 'https://html.duckduckgo.com/',
      },
      body: `q=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok && res.status !== 202) return [];
    const html = await res.text();

    const links = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"/gi)]
      .map((m) => decodeEntities(m[1]))
      .filter((url) => /^https?:\/\//i.test(url));

    return Array.from(new Set(links)).slice(0, 12);
  } catch {
    return [];
  }
}

async function searchBing(query: string): Promise<string[]> {
  try {
    const res = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const decoded = [...html.matchAll(/u=a1([A-Za-z0-9_-]+)/g)].map((m) => {
      try {
        const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        return Buffer.from(padded, 'base64').toString('utf-8');
      } catch {
        return '';
      }
    }).filter((u) => u.startsWith('http'));

    return Array.from(new Set(decoded)).slice(0, 12);
  } catch {
    return [];
  }
}

async function searchTavily(query: string): Promise<string[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query, search_depth: 'advanced', include_images: false }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => r.url).filter(Boolean);
  } catch {
    return [];
  }
}

async function searchGoogle(query: string): Promise<string[]> {
  const key = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!key || !cx) return [];
  try {
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=10`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((i: any) => i.link).filter(Boolean);
  } catch {
    return [];
  }
}

async function searchWikipedia(query: string): Promise<string[]> {
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=10`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.query?.search || []).map((s: any) => `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`);
  } catch {
    return [];
  }
}

async function searchYahoo(query: string): Promise<string[]> {
  try {
    const res = await fetch(`https://search.yahoo.com/search?p=${encodeURIComponent(query)}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const links = [...html.matchAll(/href="(https:\/\/[^"]+)"/g)]
      .map((m) => decodeEntities(m[1]))
      .filter((u) => !u.includes('yahoo.com') && !u.includes('yimg.com'));
    return Array.from(new Set(links)).slice(0, 10);
  } catch {
    return [];
  }
}

async function searchAOL(query: string): Promise<string[]> {
  try {
    const res = await fetch(`https://search.aol.com/aol/search?q=${encodeURIComponent(query)}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const links = [...html.matchAll(/href="(https:\/\/[^"]+)"/g)]
      .map((m) => decodeEntities(m[1]))
      .filter((u) => !u.includes('aol.com') && !u.includes('yahoo.com'));
    return Array.from(new Set(links)).slice(0, 10);
  } catch {
    return [];
  }
}

async function searchAsk(query: string): Promise<string[]> {
  try {
    const res = await fetch(`https://www.ask.com/web?q=${encodeURIComponent(query)}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const links = [...html.matchAll(/href="(https:\/\/[^"]+)"/g)]
      .map((m) => decodeEntities(m[1]))
      .filter((u) => !u.includes('ask.com'));
    return Array.from(new Set(links)).slice(0, 10);
  } catch {
    return [];
  }
}

async function multiSearch(query: string): Promise<string[]> {
  const settled = await Promise.allSettled([
    searchTavily(query),
    searchGoogle(query),
    searchDuckDuckGo(query),
    searchBing(query),
    searchWikipedia(query),
    searchYahoo(query),
    searchAOL(query),
    searchAsk(query),
  ]);

  const allUrls: string[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allUrls.push(...result.value);
    }
  }

  const filtered = allUrls.filter(u => u.startsWith('http') && !u.includes('google.com/aclk') && !u.includes('doubleclick.net'));
  return Array.from(new Set(filtered)).slice(0, 50);
}

async function fetchWebsiteSnapshot(url: string): Promise<{ title: string; snippet: string } | null> {
  if (url.toLowerCase().endsWith('.pdf')) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; ForgeResearchBot/1.0; +https://forge.app)',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) return null;
    
    const html = (await res.text()).slice(0, 80_000);
    const title = extractTitle(html) || domainFor(url);
    const description = extractDescription(html);
    const plain = stripHtml(html).slice(0, 450);
    const snippet = description || plain || 'No extractable summary.';
    return { title, snippet };
  } catch {
    return null;
  }
}

async function buildPlan(query: string): Promise<string> {
  const fallback = [
    `1. Scope and constraints for: ${query}`,
    '2. Generate broad search fan-out and hypothesis matrix.',
    '3. Analyze primary and secondary sources iteratively.',
    '4. Identify evidence gaps and run follow-up searches.',
    '5. Produce a citable report with confidence and limitations.',
  ].join('\n');

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fallback;

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
    const prompt = `You are an expert AI research agent. Create a precise, numbered 5-step research plan for thoroughly investigating this query: "${query}".\n\nDo not output markdown code blocks. Just output plain text numbered 1 through 5 with your actionable steps focusing on scope, search fan-out, analysis, evidence gaps, and synthesis. Keep it professional and strictly relevant.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    if (text) return text;
  } catch (err) {
    console.warn('[research] failed to build plan with AI, using fallback:', err);
  }

  return fallback;
}

async function buildQueryFanout(state: ResearchState): Promise<string[]> {
  const seeds = [
    state.query,
    `${state.query} official documentation`,
    `${state.query} latest research paper`,
    `${state.query} industry analysis 2025 2026`,
    `${state.query} benchmark comparison`,
    `${state.query} limitations and risks`,
    `${state.query} case study`,
    `${state.query} expert interview`,
    `${state.query} economics and costs`,
    `${state.query} timeline and adoption`,
    `${state.query} open source tools`,
    `${state.query} enterprise usage`,
  ];

  const key = process.env.GEMINI_API_KEY;
  if (key && state.learnedSoFar.length > 0) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });
      const prompt = `Research query: "${state.query}"\nLearned so far:\n${state.learnedSoFar.slice(0, 10).join('\n')}\n\nGenerate 20 highly specific, deep-dive search queries to uncover completely new angles, case studies, or missing evidence that was not covered yet. Return ONLY a plain text list separated by newlines, no numbers, no bullets.`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const generated = text.split('\n').map((q) => q.trim().replace(/^[-.*0-9]+\s*/, '')).filter(Boolean);
      seeds.push(...generated);
    } catch (err) {
      console.warn('[research] failed to build fanout with AI:', err);
    }
  }

  // Multiply by modifiers to ensure massive dynamic fanout (hundreds of queries available)
  const modifiers = ['', ' "case study"', ' metrics', ' review', ' "pdf"', ' site:edu', ' site:gov', ' "analysis"', ' opinion'];
  const baseSeeds = [...seeds];
  for (const seed of baseSeeds.slice(0, 15)) {
    for (const mod of modifiers) {
      if (mod) seeds.push(`${seed}${mod}`);
    }
  }

  return Array.from(new Set(seeds));
}

function event(phase: ResearchPhase, message: string): ResearchEvent {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: nowISO(),
    phase,
    message,
  };
}

function estimateDepthScore(state: ResearchState): number {
  const sourceFactor = Math.min(70, (state.stats.sourcesAnalyzed / TARGET_SOURCES) * 70);
  const domainFactor = Math.min(20, state.stats.uniqueDomains * 0.5);
  const iterationFactor = Math.min(10, state.stats.iterations * 0.6);
  return Math.round(sourceFactor + domainFactor + iterationFactor);
}

function estimateEtaMinutes(state: ResearchState): number {
  const remaining = Math.max(0, TARGET_SOURCES - state.stats.sourcesAnalyzed);
  const perMinute = 8;
  return Math.max(1, Math.ceil(remaining / perMinute));
}

function buildProgress(state: ResearchState): number {
  if (state.phase === 'complete') return 100;
  if (state.phase === 'stopped') return state.progress;

  const base = 8;
  const sourceProgress = Math.min(82, (state.stats.sourcesAnalyzed / TARGET_SOURCES) * 82);
  const synth = state.phase === 'synthesizing' ? 8 : 0;
  return Math.min(98, Math.round(base + sourceProgress + synth));
}

export async function saveResearchState(state: ResearchState, forceGithub = false): Promise<void> {
  const updated = { ...state, updatedAt: nowISO() };

  // Always persist locally as resilient fallback.
  await writeLocal(localStatePath(state.sessionId, state.id), JSON.stringify(updated, null, 2));
  await writeLocal(localIndexPath(state.id), JSON.stringify({ sessionId: state.sessionId }, null, 2));

  // Throttle GitHub writes: only every 3rd iteration or on force (complete/stop/plan actions)
  _githubSaveIteration++;
  const shouldSyncGithub = forceGithub || _githubSaveIteration % 3 === 0 || state.phase === 'complete' || state.phase === 'stopped';
  if (!shouldSyncGithub || _githubSaveLock) return;

  _githubSaveLock = true;
  try {
    await githubWriteFile(researchStatePath(state.sessionId, state.id), JSON.stringify(updated, null, 2), `Save research ${state.id}`);
    await githubWriteFile(researchIndexPath(state.id), JSON.stringify({ sessionId: state.sessionId }, null, 2), `Index research ${state.id}`);
  } catch (err) {
    console.warn('[research] GitHub persistence unavailable, continuing with local fallback.');
  } finally {
    _githubSaveLock = false;
  }
}

export async function loadResearchStateById(researchId: string, sessionId?: string): Promise<ResearchState | null> {
  let finalSessionId = sessionId;

  // 1) Resolve session id from local index quickly.
  if (!finalSessionId) {
    const localIdxRaw = await readLocal(localIndexPath(researchId));
    const localIdx = safeJsonParse<{ sessionId: string }>(localIdxRaw);
    finalSessionId = localIdx?.sessionId;
  }

  // 2) Resolve session id from GitHub index if still unknown.
  if (!finalSessionId) {
    const idxRaw = await githubReadFile(researchIndexPath(researchId));
    const idx = safeJsonParse<{ sessionId: string }>(idxRaw);
    finalSessionId = idx?.sessionId;
  }

  if (!finalSessionId) return null;

  // Prefer local state first for resilience and speed.
  const localRaw = await readLocal(localStatePath(finalSessionId, researchId));
  const localState = safeJsonParse<ResearchState>(localRaw);
  if (localState) return localState;

  const raw = await githubReadFile(researchStatePath(finalSessionId, researchId));
  return safeJsonParse<ResearchState>(raw);
}

export async function createResearchState(args: { id: string; sessionId: string; query: string }): Promise<ResearchState> {
  const createdAt = nowISO();
  return {
    id: args.id,
    sessionId: args.sessionId,
    query: args.query,
    createdAt,
    updatedAt: createdAt,
    lastAdvancedAt: createdAt,
    phase: 'awaiting_plan',
    progress: 2,
    etaMinutes: 45,
    planDraft: await buildPlan(args.query),
    planApproved: false,
    pendingQueries: [],
    processedQueries: [],
    websites: [],
    citations: [],
    notes: [],
    events: [event('awaiting_plan', 'Research session created. Plan draft is ready for review.')],
    learnedSoFar: [],
    stats: {
      sourcesAnalyzed: 0,
      tokensUsedEstimate: 0,
      depthScore: 0,
      queriesGenerated: 0,
      iterations: 0,
      uniqueDomains: 0,
    },
    control: {
      paused: false,
      stopped: false,
    },
  };
}

function upsertWebsite(state: ResearchState, website: ResearchWebsite): void {
  const idx = state.websites.findIndex((w) => w.url === website.url);
  if (idx >= 0) {
    state.websites[idx] = website;
  } else {
    state.websites.unshift(website);
    if (state.websites.length > 140) state.websites = state.websites.slice(0, 140);
  }
}

function addCitation(state: ResearchState, url: string, title: string): number {
  const existing = state.citations.find((c) => c.url === url);
  if (existing) return existing.id;

  const citationId = state.citations.length + 1;
  state.citations.push({
    id: citationId,
    url,
    domain: domainFor(url),
    title: title || domainFor(url),
  });
  return citationId;
}

async function synthesizeReport(state: ResearchState): Promise<ResearchReport> {
  const citationsText = state.citations
    .slice(0, 120)
    .map((c) => `[${c.id}] ${c.title} - ${c.url}`)
    .join('\n');

  const notesText = state.notes
    .slice(0, 160)
    .map((n) => `- [${n.citationId}] ${n.summary}`)
    .join('\n');

  const fallbackReport = (): ResearchReport => {
    const sections: ResearchReportSection[] = [
      {
        id: 'overview',
        title: 'Executive Overview',
        body: state.learnedSoFar.slice(0, 6).map((v) => `- ${v}`).join('\n') || 'No major findings were extracted.',
      },
      {
        id: 'evidence',
        title: 'Evidence and Signals',
        body: state.notes.slice(0, 18).map((n) => `${n.summary} [${n.citationId}]`).join('\n\n') || 'No evidence collected.',
      },
      {
        id: 'limits',
        title: 'Limits and Open Questions',
        body: 'This report is generated from publicly retrievable web pages and may omit paywalled/private data. Continue with follow-up prompts for deeper niche coverage.',
      },
    ];

    const markdown = `# Deep Research Report\n\n## Query\n${state.query}\n\n## Executive Summary\n${state.learnedSoFar.slice(0, 5).join(' ')}\n\n${sections
      .map((s) => `## ${s.title}\n${s.body}`)
      .join('\n\n')}\n\n## Citations\n${state.citations.map((c) => `- [${c.id}] ${c.title} (${c.url})`).join('\n')}`;

    return {
      title: `Deep Research: ${state.query}`,
      summary: state.learnedSoFar.slice(0, 3).join(' ') || 'Research complete.',
      sections,
      citations: state.citations,
      markdown,
      generatedAt: nowISO(),
    };
  };

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fallbackReport();

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite-preview',
      generationConfig: { maxOutputTokens: 8192 }
    });
    const prompt = `${RESEARCHER_SYSTEM_PROMPT}\n\nThe user requests an EXTREMELY detailed, comprehensive, and exhaustive final report on the query: "${state.query}". The report MUST be at least 1500 words or 500 lines long. You have access to hundreds of analyzed sources. DO NOT summarize briefly. Provide extreme details, deep analysis, extensive data points, contradictions, case studies, and exact figures from the provided notes. The output must be huge, comprehensive, and exhaustive.\n\nReturn JSON only with this shape:\n{\n  "title": string,\n  "summary": "A 3-4 paragraph deep executive summary",\n  "sections": [{"id": string, "title": string, "body": "AT LEAST 400 WORDS OF EXHAUSTIVE, DETAILED TEXT PER SECTION"}]\n}\n\nUse inline citation marks like [12] in section bodies extensively. Use only citations present in provided source list.\n\nCITATIONS:\n${citationsText}\n\nNOTES:\n${notesText}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = safeJsonParse<{ title: string; summary: string; sections: ResearchReportSection[] }>(text);

    if (!parsed?.sections?.length) return fallbackReport();

    const markdown = `# ${parsed.title}\n\n## Query\n${state.query}\n\n## Executive Summary\n${parsed.summary}\n\n${parsed.sections
      .map((s) => `## ${s.title}\n${s.body}`)
      .join('\n\n')}\n\n## Citations\n${state.citations.map((c) => `- [${c.id}] ${c.title} (${c.url})`).join('\n')}`;

    return {
      title: parsed.title,
      summary: parsed.summary,
      sections: parsed.sections,
      citations: state.citations,
      markdown,
      generatedAt: nowISO(),
    };
  } catch {
    return fallbackReport();
  }
}

export async function advanceResearchState(state: ResearchState): Promise<ResearchState> {
  state.lastAdvancedAt = nowISO();

  if (state.control.stopped || state.phase === 'stopped' || state.phase === 'complete' || state.phase === 'error') {
    return state;
  }

  if (state.control.paused) {
    if (state.phase !== 'paused') {
      state.phase = 'paused';
      state.events.unshift(event('paused', 'Research paused. Waiting for resume.'));
    }
    return state;
  }

  if (state.phase === 'paused') {
    state.phase = state.pendingQueries.length > 0 ? 'analyzing' : 'query_fanout';
    state.events.unshift(event(state.phase, 'Research resumed. Continuing iterative analysis.'));
  }

  if (!state.planApproved) {
    state.phase = 'awaiting_plan';
    state.progress = 4;
    state.etaMinutes = 45;
    return state;
  }

  if (state.pendingQueries.length === 0 && state.phase !== 'synthesizing') {
    state.phase = 'query_fanout';
    const fanout = (await buildQueryFanout(state))
      .filter((q) => !state.processedQueries.includes(q))
      .slice(0, 24);

    state.pendingQueries.push(...fanout);
    state.stats.queriesGenerated = state.pendingQueries.length + state.processedQueries.length;
    state.events.unshift(event('query_fanout', `Generated ${fanout.length} additional search vectors.`));
    state.phase = 'analyzing';
  }

  if (state.stats.sourcesAnalyzed >= TARGET_SOURCES) {
    state.phase = 'synthesizing';
  }

  if (state.phase === 'analyzing') {
    const query = state.pendingQueries.shift();
    if (query) {
      state.processedQueries.push(query);
      state.stats.iterations += 1;
      state.events.unshift(event('analyzing', `Running query: ${query}`));

      const urls = await multiSearch(query);
      const candidateUrls = compact(urls).slice(0, 30);
      let analyzedInSlice = 0;

      const failedDomains = new Set(
        state.websites.filter(w => w.status === 'failed').map(w => w.domain)
      );

      for (const url of candidateUrls) {
        if (state.stats.sourcesAnalyzed >= TARGET_SOURCES) break;
        
        // Skip if we already attempted this exact URL
        const existing = state.websites.find((w) => w.url === url);
        if (existing) continue;

        // Skip if this domain previously failed scraping completely
        const domain = domainFor(url);
        if (failedDomains.has(domain)) continue;

        const queued: ResearchWebsite = {
          id: `site_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          url,
          domain: domainFor(url),
          title: domainFor(url),
          status: 'fetching',
          favicon: faviconFor(url),
        };
        upsertWebsite(state, queued);

        const snap = await fetchWebsiteSnapshot(url);
        if (!snap) {
          queued.status = 'failed';
          queued.checkedAt = nowISO();
          upsertWebsite(state, queued);
          failedDomains.add(domain);
          continue;
        }

        const citationId = addCitation(state, url, snap.title);
        state.notes.unshift({
          citationId,
          summary: snap.snippet,
        });

        queued.title = snap.title;
        queued.snippet = snap.snippet;
        queued.status = 'analyzed';
        queued.checkedAt = nowISO();
        upsertWebsite(state, queued);

        state.learnedSoFar = [
          snap.snippet,
          ...state.learnedSoFar,
        ].slice(0, 18);

        state.stats.sourcesAnalyzed += 1;
        state.stats.tokensUsedEstimate += Math.ceil((snap.snippet.length + snap.title.length) / 4);
        analyzedInSlice += 1;

        if (analyzedInSlice >= 5) break;
      }

      const uniqueDomains = new Set(state.citations.map((c) => c.domain));
      state.stats.uniqueDomains = uniqueDomains.size;
      state.stats.depthScore = estimateDepthScore(state);
      state.etaMinutes = estimateEtaMinutes(state);
      state.progress = buildProgress(state);
      state.events.unshift(event('analyzing', `Analyzed ${analyzedInSlice} sources this iteration. Total: ${state.stats.sourcesAnalyzed}.`));
    }

    if (state.stats.sourcesAnalyzed >= TARGET_SOURCES || (state.pendingQueries.length === 0 && state.stats.iterations > 10)) {
      state.phase = 'synthesizing';
      state.events.unshift(event('synthesizing', 'Source depth reached. Synthesizing final report.'));
    }
  }

  if (state.phase === 'synthesizing') {
    const report = await synthesizeReport(state);
    state.report = report;
    state.phase = 'complete';
    state.progress = 100;
    state.etaMinutes = 0;
    state.completedAt = nowISO();
    state.events.unshift(event('complete', 'Deep research completed with citable synthesis.'));
  }

  return state;
}

export function buildResearchId() {
  return `rs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
