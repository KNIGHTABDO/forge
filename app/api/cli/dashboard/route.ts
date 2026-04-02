import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { getRuntimeTelemetrySnapshot } from '@/lib/runtime-telemetry';

type DashboardAnalytics = {
  commandsExecuted: number;
  filesEdited: number;
  activeSwarms: number;
  messagesSent: number;
  assistantResponses: number;
  searchQueries: number;
  toolCalls: number;
  sessionsStarted: number;
  failedTurns: number;
  lastModel?: string;
  lastProvider?: string;
  lastWorkspacePath?: string;
};

type DashboardDevice = {
  id: string;
  name: string;
  os: string;
  platform?: string;
  deviceType?: string;
  appVersion?: string;
  active: boolean;
  lastUsed: number;
};

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

function asNonNegativeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function asOptionalString(value: unknown, maxLength = 260): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLength);
}

function timestampToMillis(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === 'object') {
    const candidate = value as { toMillis?: () => number; seconds?: unknown };
    if (typeof candidate.toMillis === 'function') {
      const millis = candidate.toMillis();
      if (Number.isFinite(millis)) {
        return Math.max(0, millis);
      }
    }

    const seconds = Number(candidate.seconds);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000);
    }
  }

  return 0;
}

function emptyAnalytics(): DashboardAnalytics {
  return {
    commandsExecuted: 0,
    filesEdited: 0,
    activeSwarms: 0,
    messagesSent: 0,
    assistantResponses: 0,
    searchQueries: 0,
    toolCalls: 0,
    sessionsStarted: 0,
    failedTurns: 0,
  };
}

function mergeAnalytics(
  runtimeAnalytics: DashboardAnalytics,
  firestoreAnalytics: Partial<DashboardAnalytics> | null,
): DashboardAnalytics {
  const fromFirestore = firestoreAnalytics || {};

  return {
    commandsExecuted: Math.max(
      asNonNegativeNumber(fromFirestore.commandsExecuted),
      asNonNegativeNumber(runtimeAnalytics.commandsExecuted),
    ),
    filesEdited: Math.max(
      asNonNegativeNumber(fromFirestore.filesEdited),
      asNonNegativeNumber(runtimeAnalytics.filesEdited),
    ),
    activeSwarms: Math.max(
      asNonNegativeNumber(fromFirestore.activeSwarms),
      asNonNegativeNumber(runtimeAnalytics.activeSwarms),
    ),
    messagesSent: Math.max(
      asNonNegativeNumber(fromFirestore.messagesSent),
      asNonNegativeNumber(runtimeAnalytics.messagesSent),
    ),
    assistantResponses: Math.max(
      asNonNegativeNumber(fromFirestore.assistantResponses),
      asNonNegativeNumber(runtimeAnalytics.assistantResponses),
    ),
    searchQueries: Math.max(
      asNonNegativeNumber(fromFirestore.searchQueries),
      asNonNegativeNumber(runtimeAnalytics.searchQueries),
    ),
    toolCalls: Math.max(
      asNonNegativeNumber(fromFirestore.toolCalls),
      asNonNegativeNumber(runtimeAnalytics.toolCalls),
    ),
    sessionsStarted: Math.max(
      asNonNegativeNumber(fromFirestore.sessionsStarted),
      asNonNegativeNumber(runtimeAnalytics.sessionsStarted),
    ),
    failedTurns: Math.max(
      asNonNegativeNumber(fromFirestore.failedTurns),
      asNonNegativeNumber(runtimeAnalytics.failedTurns),
    ),
    lastModel: runtimeAnalytics.lastModel || fromFirestore.lastModel,
    lastProvider: runtimeAnalytics.lastProvider || fromFirestore.lastProvider,
    lastWorkspacePath:
      runtimeAnalytics.lastWorkspacePath || fromFirestore.lastWorkspacePath,
  };
}

function normalizeRuntimeDevice(value: {
  id: string;
  name: string;
  os: string;
  platform?: string;
  deviceType?: string;
  appVersion?: string;
  active: boolean;
  lastUsed: number;
}): DashboardDevice {
  return {
    id: value.id,
    name: value.name,
    os: value.os,
    platform: value.platform,
    deviceType: value.deviceType,
    appVersion: value.appVersion,
    active: value.active !== false,
    lastUsed: timestampToMillis(value.lastUsed),
  };
}

function normalizeFirestoreDevice(id: string, value: Record<string, unknown>): DashboardDevice {
  return {
    id,
    name: asOptionalString(value.name, 120) || 'Unknown Device',
    os: asOptionalString(value.os, 120) || 'Unknown OS',
    platform: asOptionalString(value.platform, 40),
    deviceType: asOptionalString(value.deviceType, 30),
    appVersion: asOptionalString(value.appVersion, 40),
    active: value.active !== false,
    lastUsed: timestampToMillis(value.lastUsed),
  };
}

function mergeDevices(runtimeDevices: DashboardDevice[], firestoreDevices: DashboardDevice[]): DashboardDevice[] {
  const map = new Map<string, DashboardDevice>();

  for (const device of runtimeDevices) {
    map.set(device.id, device);
  }

  for (const device of firestoreDevices) {
    const existing = map.get(device.id);
    if (!existing) {
      map.set(device.id, device);
      continue;
    }

    map.set(device.id, {
      id: device.id,
      name: existing.name || device.name,
      os: existing.os || device.os,
      platform: existing.platform || device.platform,
      deviceType: existing.deviceType || device.deviceType,
      appVersion: existing.appVersion || device.appVersion,
      active: existing.active !== false && device.active !== false,
      lastUsed: Math.max(existing.lastUsed, device.lastUsed),
    });
  }

  return Array.from(map.values())
    .filter((device) => device.active !== false)
    .sort((a, b) => b.lastUsed - a.lastUsed);
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let uid: string | null = null;

    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
        }

        uid = decodeUidFromJwtWithoutVerification(token);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Firebase Admin is not configured for dashboard requests' },
          { status: 503 },
        );
      }

      uid = decodeUidFromJwtWithoutVerification(token);
    }

    if (!uid) {
      return NextResponse.json({ error: 'Unable to resolve user identity from token' }, { status: 401 });
    }

    const runtimeSnapshot = getRuntimeTelemetrySnapshot(uid);
    const runtimeAnalytics: DashboardAnalytics = {
      ...emptyAnalytics(),
      ...runtimeSnapshot.analytics,
    };
    const runtimeDevices = runtimeSnapshot.devices.map(normalizeRuntimeDevice);

    let firestoreAnalytics: Partial<DashboardAnalytics> | null = null;
    let firestoreDevices: DashboardDevice[] = [];
    const warnings: string[] = [];

    if (adminDb && adminAuth) {
      const userRef = adminDb.collection('users').doc(uid);

      try {
        const analyticsDoc = await userRef.collection('analytics').doc('current').get();
        if (analyticsDoc.exists) {
          const data = analyticsDoc.data() || {};
          firestoreAnalytics = {
            commandsExecuted: asNonNegativeNumber(data.commandsExecuted),
            filesEdited: asNonNegativeNumber(data.filesEdited),
            activeSwarms: asNonNegativeNumber(data.activeSwarms),
            messagesSent: asNonNegativeNumber(data.messagesSent),
            assistantResponses: asNonNegativeNumber(data.assistantResponses),
            searchQueries: asNonNegativeNumber(data.searchQueries),
            toolCalls: asNonNegativeNumber(data.toolCalls),
            sessionsStarted: asNonNegativeNumber(data.sessionsStarted),
            failedTurns: asNonNegativeNumber(data.failedTurns),
            lastModel: asOptionalString(data.lastModel, 120),
            lastProvider: asOptionalString(data.lastProvider, 60),
            lastWorkspacePath: asOptionalString(data.lastWorkspacePath, 260),
          };
        }
      } catch (error) {
        warnings.push(`Analytics read failed: ${String(error)}`);
      }

      try {
        const deviceSnapshot = await userRef.collection('devices').get();
        firestoreDevices = deviceSnapshot.docs
          .map((docSnap) => normalizeFirestoreDevice(docSnap.id, docSnap.data() as Record<string, unknown>))
          .filter((device) => device.active !== false)
          .sort((a, b) => b.lastUsed - a.lastUsed);
      } catch (error) {
        warnings.push(`Device read failed: ${String(error)}`);
      }
    } else {
      warnings.push('Firestore is unavailable; serving runtime fallback telemetry.');
    }

    const analytics = mergeAnalytics(runtimeAnalytics, firestoreAnalytics);
    const devices = mergeDevices(runtimeDevices, firestoreDevices);

    return NextResponse.json(
      warnings.length > 0
        ? { analytics, devices, warnings }
        : { analytics, devices },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load dashboard data',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
