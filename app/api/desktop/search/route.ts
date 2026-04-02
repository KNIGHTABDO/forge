import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { mergeRuntimeAnalytics } from '@/lib/runtime-telemetry';

type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

async function recordDesktopSearchUsage(uid: string | null): Promise<void> {
  if (!uid) {
    return;
  }

  mergeRuntimeAnalytics(uid, {
    searchQueries: 1,
  });

  if (!adminDb) {
    return;
  }

  try {
    const analyticsRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('analytics')
      .doc('current');

    await analyticsRef.set(
      {
        searchQueries: admin.firestore.FieldValue.increment(1),
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Desktop search telemetry warning:', error);
  }
}

function decodeUidFromJwtWithoutVerification(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      sub?: unknown;
      user_id?: unknown;
      uid?: unknown;
    };

    if (typeof decoded.user_id === 'string' && decoded.user_id.trim()) {
      return decoded.user_id.trim();
    }
    if (typeof decoded.uid === 'string' && decoded.uid.trim()) {
      return decoded.uid.trim();
    }
    if (typeof decoded.sub === 'string' && decoded.sub.trim()) {
      return decoded.sub.trim();
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeQuery(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, 180);
}

function normalizeLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 6;
  }

  return Math.min(10, Math.max(1, Math.floor(parsed)));
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function domainFor(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return 'web';
  }
}

function toSnippet(value: unknown): string {
  if (typeof value !== 'string') {
    return 'No summary available.';
  }

  const text = stripHtml(decodeHtml(value));
  if (!text) {
    return 'No summary available.';
  }

  return text.slice(0, 280);
}

function toTitle(value: unknown, fallbackUrl: string): string {
  if (typeof value !== 'string') {
    return domainFor(fallbackUrl);
  }

  const cleaned = stripHtml(decodeHtml(value));
  return cleaned || domainFor(fallbackUrl);
}

async function searchTavily(query: string, limit: number): Promise<SearchHit[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_images: false,
        max_results: limit,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const results = (payload as { results?: unknown }).results;
    if (!Array.isArray(results)) {
      return [];
    }

    return results
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const item = entry as Record<string, unknown>;
        const url = typeof item.url === 'string' ? item.url : '';
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return null;
        }

        return {
          title: toTitle(item.title, url),
          url,
          snippet: toSnippet(item.content),
          source: 'tavily',
        } satisfies SearchHit;
      })
      .filter((entry): entry is SearchHit => Boolean(entry));
  } catch {
    return [];
  }
}

async function searchDuckDuckGo(query: string, limit: number): Promise<SearchHit[]> {
  try {
    const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const titleMatches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const snippetMatches = [...html.matchAll(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi)];

    const hits: SearchHit[] = [];

    for (let i = 0; i < titleMatches.length && hits.length < limit; i += 1) {
      const url = decodeHtml(titleMatches[i][1] || '');
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        continue;
      }

      const title = toTitle(titleMatches[i][2], url);
      const snippet = toSnippet(snippetMatches[i]?.[1] || 'No summary available.');

      hits.push({
        title,
        url,
        snippet,
        source: 'duckduckgo',
      });
    }

    return hits;
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let verifiedUid: string | null = null;

    if (!adminAuth) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Firebase Admin is not configured' }, { status: 503 });
      }

      verifiedUid = decodeUidFromJwtWithoutVerification(idToken);
    } else {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        verifiedUid = decoded.uid;
      } catch {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }

        verifiedUid = decodeUidFromJwtWithoutVerification(idToken);
      }
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const query = normalizeQuery(body.query);
    const limit = normalizeLimit(body.limit);

    if (query.length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters.' }, { status: 400 });
    }

    let results = await searchTavily(query, limit);
    if (results.length === 0) {
      results = await searchDuckDuckGo(query, limit);
    }

    void recordDesktopSearchUsage(verifiedUid);

    return NextResponse.json({
      results: results.slice(0, limit),
      query,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to search web sources',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
