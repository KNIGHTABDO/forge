import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

let telemetryRegistryAvailable = true;

function isFirestoreNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  const code = maybeError.code;
  const message = String(maybeError.message ?? '');

  return code === 5 || code === '5' || code === 'NOT_FOUND' || /NOT_FOUND/i.test(message);
}

function asNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!adminAuth || !adminDb) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Firebase Admin not initialized properly' },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          success: true,
          warning:
            'Firebase Admin is unavailable; telemetry persistence skipped in development mode',
        },
        { status: 200 },
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token', details: String(error) },
        { status: 401 },
      );
    }
    const uid = decodedToken.uid;

    let data: Record<string, unknown>;
    try {
      data = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { deviceId, deviceName, os, commandsExecuted, filesEdited, activeSwarms } = data;

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId in payload' }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(uid);
    const warnings: string[] = [];

    if (!telemetryRegistryAvailable) {
      return NextResponse.json({
        success: true,
        warnings: ['Telemetry registry currently unavailable; writes are temporarily skipped.'],
      });
    }

    try {
      await userRef.set(
        {
          lastCliSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (dbError) {
      const isNotFound = isFirestoreNotFoundError(dbError);
      if (isNotFound) {
        telemetryRegistryAvailable = false;
      }
      warnings.push(
        isNotFound
          ? 'User registry unavailable (Firestore NOT_FOUND).'
          : 'User registry update failed.',
      );
      if (!isNotFound) {
        console.warn('CLI telemetry user registry warning:', dbError);
      }
    }

    // 1. Update/Register device
    try {
      await userRef.collection('devices').doc(String(deviceId)).set(
        {
          name: (typeof deviceName === 'string' && deviceName.trim()) || 'Unknown Device',
          os: (typeof os === 'string' && os.trim()) || 'Unknown OS',
          lastUsed: admin.firestore.FieldValue.serverTimestamp(),
          active: true,
        },
        { merge: true },
      );
    } catch (dbError) {
      const isNotFound = isFirestoreNotFoundError(dbError);
      if (isNotFound) {
        telemetryRegistryAvailable = false;
      }
      warnings.push(
        isNotFound
          ? 'Device telemetry skipped (Firestore NOT_FOUND).'
          : 'Device telemetry write failed.',
      );
      if (!isNotFound) {
        console.warn('CLI telemetry device warning:', dbError);
      }
    }

    // 2. Update usage analytics
    const analyticsRef = userRef.collection('analytics').doc('current');
    const deltaCommandsExecuted = asNonNegativeNumber(commandsExecuted);
    const deltaFilesEdited = asNonNegativeNumber(filesEdited);
    const deltaActiveSwarms = asNonNegativeNumber(activeSwarms);

    try {
      await analyticsRef.set(
        {
          commandsExecuted: admin.firestore.FieldValue.increment(deltaCommandsExecuted),
          filesEdited: admin.firestore.FieldValue.increment(deltaFilesEdited),
          activeSwarms: admin.firestore.FieldValue.increment(deltaActiveSwarms),
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (dbError) {
      const isNotFound = isFirestoreNotFoundError(dbError);
      if (isNotFound) {
        telemetryRegistryAvailable = false;
      }
      warnings.push(
        isNotFound
          ? 'Analytics telemetry skipped (Firestore NOT_FOUND).'
          : 'Analytics telemetry write failed.',
      );
      if (!isNotFound) {
        console.warn('CLI telemetry analytics warning:', dbError);
      }
    }

    return NextResponse.json(
      warnings.length > 0 ? { success: true, warnings } : { success: true },
    );
  } catch (error: any) {
    console.error('CLI telemetry error:', error);
    return NextResponse.json(
      { error: 'Failed to record telemetry', details: String(error) },
      { status: 500 },
    );
  }
}
