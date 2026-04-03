import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { checkGeminiCliAvailability } from '@/lib/gemini-cli';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getRequestId(request: Request): string {
  const provided =
    request.headers.get('x-correlation-id') ||
    request.headers.get('X-Correlation-Id') ||
    request.headers.get('x-request-id') ||
    request.headers.get('X-Request-Id');

  const normalized = (provided || '').trim();
  return normalized || crypto.randomUUID();
}

function getBearerToken(request: Request): string | null {
  const authHeader =
    request.headers.get('authorization') || request.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1].trim();
  return token || null;
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

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const token = getBearerToken(request);

  try {
    let uid: string | null = null;

    if (process.env.NODE_ENV === 'production') {
      if (!token || !adminAuth) {
        return NextResponse.json(
          {
            error: 'Missing or invalid authorization context for desktop health check.',
            errorCode: 'AUTH_REQUIRED',
            requestId,
          },
          { status: 401 },
        );
      }

      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        return NextResponse.json(
          {
            error: 'Invalid or expired token',
            errorCode: 'AUTH_INVALID',
            requestId,
          },
          { status: 401 },
        );
      }
    } else if (token && adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        uid = decodeUidFromJwtWithoutVerification(token);
      }
    } else if (token) {
      uid = decodeUidFromJwtWithoutVerification(token);
    }

    if (!uid) {
      return NextResponse.json(
        {
          error: 'Unable to resolve user identity from token',
          errorCode: 'AUTH_IDENTITY_UNRESOLVED',
          requestId,
        },
        { status: 401 },
      );
    }

    const cliAvailability = await checkGeminiCliAvailability(5000);
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
    const geminiKeyReady = Boolean((process.env.GEMINI_API_KEY || '').trim());

    const guidance: string[] = [];
    if (!geminiKeyReady) {
      guidance.push('Configure GEMINI_API_KEY in backend environment variables.');
    }
    if (!cliAvailability.ready) {
      guidance.push(
        cliAvailability.details ||
          'Gemini CLI command unavailable. Install @google/gemini-cli or set GEMINI_CLI_COMMAND.',
      );
    }

    const status = geminiKeyReady && cliAvailability.ready ? 'ready' : 'degraded';

    return NextResponse.json(
      {
        status,
        auth: {
          verified: true,
        },
        gemini: {
          keyReady: geminiKeyReady,
          model: geminiModel,
          cliReady: cliAvailability.ready,
          ...(cliAvailability.commandSource ? { commandSource: cliAvailability.commandSource } : {}),
          ...(cliAvailability.command ? { command: cliAvailability.command } : {}),
        },
        runtime: {
          nodeVersion: process.version,
          platform: process.platform,
        },
        guidance,
        requestId,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to resolve desktop health',
        errorCode: 'HEALTH_CHECK_FAILED',
        details: String(error),
        requestId,
      },
      { status: 500 },
    );
  }
}
