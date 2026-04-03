import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { upsertRuntimeDevice } from '@/lib/runtime-telemetry';

type CliKeys = {
  GEMINI_API_KEY: string | null;
  GITHUB_TOKEN: string | null;
  GEMINI_MODEL: string;
  GITHUB_MODEL: string;
};

type DeviceType = 'cli' | 'desktop_app' | 'web';

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

function isFirestoreNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  const code = maybeError.code;
  const message = String(maybeError.message ?? '');

  return code === 5 || code === '5' || code === 'NOT_FOUND' || /NOT_FOUND/i.test(message);
}

function getKeysFromEnv(): CliKeys {
  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || null,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || null,
    GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview',
    GITHUB_MODEL: process.env.GITHUB_MODEL || 'gemini-3.1-pro-preview',
  };
}

function normalizeDeviceField(value: string | null, fallback: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 120);
}

function normalizeOptionalField(value: string | null, maxLength = 80): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeDeviceType(value: string | null): DeviceType {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'desktop_app') return 'desktop_app';
  if (normalized === 'web') return 'web';
  return 'cli';
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

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const idToken = getBearerToken(req);
    if (!idToken) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header', requestId },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId parameter', requestId }, { status: 400 });
    }

    const deviceName = normalizeDeviceField(searchParams.get('deviceName'), 'Forge CLI Device');
    const deviceOs = normalizeDeviceField(searchParams.get('os'), 'Unknown OS');
    const deviceType = normalizeDeviceType(searchParams.get('deviceType'));
    const appVersion = normalizeOptionalField(searchParams.get('appVersion'), 40);
    const platform = normalizeOptionalField(searchParams.get('platform'), 40) || deviceOs;
    const keys = getKeysFromEnv();

    let uid: string | null = null;
    if (adminAuth) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        uid = decodedToken.uid;
      } catch (e) {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: 'Invalid or expired token', requestId }, { status: 401 });
        }

        uid = decodeUidFromJwtWithoutVerification(idToken);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Firebase Admin is not configured in production', requestId },
          { status: 503 },
        );
      }

      uid = decodeUidFromJwtWithoutVerification(idToken);
    }

    if (!uid) {
      return NextResponse.json({ error: 'Unable to resolve user identity from token', requestId }, { status: 401 });
    }

    upsertRuntimeDevice(uid, {
      id: deviceId,
      name: deviceName,
      os: deviceOs,
      platform,
      deviceType,
      appVersion: appVersion || undefined,
      active: true,
    });

    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        {
          keys,
          warning: 'Firebase Admin unavailable; using runtime fallback for device/session visibility.',
          requestId,
        },
        { status: 200 },
      );
    }

    const userRef = adminDb.collection('users').doc(uid);
    const deviceRef = userRef.collection('devices').doc(deviceId);

    let warning: string | undefined;

    // Enforce revocation and refresh heartbeat metadata on every successful key fetch.
    try {
      await userRef.set(
        {
          lastCliAuthAt: admin.firestore.FieldValue.serverTimestamp(),
          lastAuthAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(deviceType === 'desktop_app'
            ? { lastDesktopAuthAt: admin.firestore.FieldValue.serverTimestamp() }
            : {}),
        },
        { merge: true },
      );

      const deviceDoc = await deviceRef.get();
      if (deviceDoc.exists && deviceDoc.data()?.active === false) {
        return NextResponse.json({ error: 'Device is revoked', requestId }, { status: 403 });
      }

      await deviceRef.set(
        {
          name: deviceName,
          os: deviceOs,
          platform,
          deviceType,
          ...(appVersion ? { appVersion } : {}),
          active: true,
          lastUsed: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (dbError) {
      const isNotFound = isFirestoreNotFoundError(dbError);

      warning = isNotFound
        ? 'Device registry unavailable (Firestore NOT_FOUND). Login remains active, but usage/device data cannot be persisted.'
        : 'Device registry update failed; login remains active.';

      if (!isNotFound) {
        console.warn('CLI keys route device registry warning', {
          requestId,
          error: String(dbError),
        });
      }
    }
    
    return NextResponse.json(
      warning ? { keys, warning, requestId } : { keys, requestId },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching CLI keys', {
      requestId,
      error: String(error),
    });
    return NextResponse.json({ error: 'Internal Server Error', requestId }, { status: 500 });
  }
}
