import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

type CliKeys = {
  GEMINI_API_KEY: string | null;
  GITHUB_TOKEN: string | null;
  GEMINI_MODEL: string;
  GITHUB_MODEL: string;
};

type DeviceType = 'cli' | 'desktop_app' | 'web';

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

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId parameter' }, { status: 400 });
    }

    const deviceName = normalizeDeviceField(searchParams.get('deviceName'), 'Forge CLI Device');
    const deviceOs = normalizeDeviceField(searchParams.get('os'), 'Unknown OS');
    const deviceType = normalizeDeviceType(searchParams.get('deviceType'));
    const appVersion = normalizeOptionalField(searchParams.get('appVersion'), 40);
    const platform = normalizeOptionalField(searchParams.get('platform'), 40) || deviceOs;
    const keys = getKeysFromEnv();

    const idToken = authHeader.split('Bearer ')[1];
    
    if (!adminAuth || !adminDb) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Firebase Admin is not configured in production' },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          keys,
          warning: 'Firebase Admin unavailable; token verification skipped in development mode',
        },
        { status: 200 },
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid or expired token', details: String(e) }, { status: 401 });
    }

    const userRef = adminDb.collection('users').doc(decodedToken.uid);
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
        return NextResponse.json({ error: 'Device is revoked' }, { status: 403 });
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
        console.warn('CLI keys route device registry warning:', dbError);
      }
    }
    
    return NextResponse.json(
      warning ? { keys, warning } : { keys },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching CLI keys:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
