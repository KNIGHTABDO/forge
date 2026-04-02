import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

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

function asNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function normalizeDeviceField(value: unknown, fallback: string, maxLength = 120): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeOptionalField(value: unknown, maxLength = 80): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeDeviceType(value: unknown): DeviceType {
  if (typeof value !== 'string') {
    return 'cli';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'desktop_app') {
    return 'desktop_app';
  }
  if (normalized === 'web') {
    return 'web';
  }
  return 'cli';
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

    const {
      deviceId,
      deviceName,
      os,
      deviceType,
      appVersion,
      platform,
      commandsExecuted,
      filesEdited,
      activeSwarms,
      messagesSent,
      assistantResponses,
      searchQueries,
      toolCalls,
      sessionsStarted,
      failedTurns,
      lastModel,
      lastProvider,
      lastWorkspacePath,
    } = data;

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId in payload' }, { status: 400 });
    }

    const userRef = adminDb.collection('users').doc(uid);
    const warnings: string[] = [];

    const normalizedDeviceType = normalizeDeviceType(deviceType);
    const normalizedDeviceName = normalizeDeviceField(deviceName, 'Unknown Device');
    const normalizedOs = normalizeDeviceField(os, 'Unknown OS');
    const normalizedPlatform = normalizeOptionalField(platform, 40) || normalizedOs;
    const normalizedAppVersion = normalizeOptionalField(appVersion, 40);

    try {
      await userRef.set(
        {
          lastCliSeenAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(normalizedDeviceType === 'desktop_app'
            ? { lastDesktopSeenAt: admin.firestore.FieldValue.serverTimestamp() }
            : {}),
        },
        { merge: true },
      );
    } catch (dbError) {
      const isNotFound = isFirestoreNotFoundError(dbError);
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
          name: normalizedDeviceName,
          os: normalizedOs,
          platform: normalizedPlatform,
          deviceType: normalizedDeviceType,
          ...(normalizedAppVersion ? { appVersion: normalizedAppVersion } : {}),
          lastUsed: admin.firestore.FieldValue.serverTimestamp(),
          active: true,
        },
        { merge: true },
      );
    } catch (dbError) {
      const isNotFound = isFirestoreNotFoundError(dbError);
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
    const deltaMessagesSent = asNonNegativeNumber(messagesSent);
    const deltaAssistantResponses = asNonNegativeNumber(assistantResponses);
    const deltaSearchQueries = asNonNegativeNumber(searchQueries);
    const deltaToolCalls = asNonNegativeNumber(toolCalls);
    const deltaSessionsStarted = asNonNegativeNumber(sessionsStarted);
    const deltaFailedTurns = asNonNegativeNumber(failedTurns);
    const normalizedLastModel = normalizeOptionalField(lastModel, 120);
    const normalizedLastProvider = normalizeOptionalField(lastProvider, 60);
    const normalizedLastWorkspacePath = normalizeOptionalField(lastWorkspacePath, 260);

    try {
      await analyticsRef.set(
        {
          commandsExecuted: admin.firestore.FieldValue.increment(deltaCommandsExecuted),
          filesEdited: admin.firestore.FieldValue.increment(deltaFilesEdited),
          activeSwarms: admin.firestore.FieldValue.increment(deltaActiveSwarms),
          messagesSent: admin.firestore.FieldValue.increment(deltaMessagesSent),
          assistantResponses: admin.firestore.FieldValue.increment(deltaAssistantResponses),
          searchQueries: admin.firestore.FieldValue.increment(deltaSearchQueries),
          toolCalls: admin.firestore.FieldValue.increment(deltaToolCalls),
          sessionsStarted: admin.firestore.FieldValue.increment(deltaSessionsStarted),
          failedTurns: admin.firestore.FieldValue.increment(deltaFailedTurns),
          ...(normalizedLastModel ? { lastModel: normalizedLastModel } : {}),
          ...(normalizedLastProvider ? { lastProvider: normalizedLastProvider } : {}),
          ...(normalizedLastWorkspacePath ? { lastWorkspacePath: normalizedLastWorkspacePath } : {}),
          lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (dbError) {
      const isNotFound = isFirestoreNotFoundError(dbError);
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
