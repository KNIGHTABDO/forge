type RuntimeAnalytics = {
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

type RuntimeDevice = {
  id: string;
  name: string;
  os: string;
  platform?: string;
  deviceType?: string;
  appVersion?: string;
  lastUsed: number;
  active: boolean;
};

type RuntimeTelemetryBucket = {
  analytics: RuntimeAnalytics;
  devices: Record<string, RuntimeDevice>;
};

type RuntimeTelemetryStore = Map<string, RuntimeTelemetryBucket>;

const STORE_KEY = '__forgeRuntimeTelemetryStore';

function createEmptyAnalytics(): RuntimeAnalytics {
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

function normalizeNonNegative(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function getStore(): RuntimeTelemetryStore {
  const globalRef = globalThis as typeof globalThis & {
    [STORE_KEY]?: RuntimeTelemetryStore;
  };

  if (!globalRef[STORE_KEY]) {
    globalRef[STORE_KEY] = new Map<string, RuntimeTelemetryBucket>();
  }

  return globalRef[STORE_KEY]!;
}

function getBucket(uid: string): RuntimeTelemetryBucket {
  const store = getStore();
  const existing = store.get(uid);
  if (existing) {
    return existing;
  }

  const created: RuntimeTelemetryBucket = {
    analytics: createEmptyAnalytics(),
    devices: {},
  };

  store.set(uid, created);
  return created;
}

export function mergeRuntimeAnalytics(uid: string | null, delta: Partial<RuntimeAnalytics>): void {
  if (!uid) {
    return;
  }

  const bucket = getBucket(uid);
  bucket.analytics.commandsExecuted += normalizeNonNegative(delta.commandsExecuted);
  bucket.analytics.filesEdited += normalizeNonNegative(delta.filesEdited);
  bucket.analytics.activeSwarms += normalizeNonNegative(delta.activeSwarms);
  bucket.analytics.messagesSent += normalizeNonNegative(delta.messagesSent);
  bucket.analytics.assistantResponses += normalizeNonNegative(delta.assistantResponses);
  bucket.analytics.searchQueries += normalizeNonNegative(delta.searchQueries);
  bucket.analytics.toolCalls += normalizeNonNegative(delta.toolCalls);
  bucket.analytics.sessionsStarted += normalizeNonNegative(delta.sessionsStarted);
  bucket.analytics.failedTurns += normalizeNonNegative(delta.failedTurns);

  const lastModel = typeof delta.lastModel === 'string' ? delta.lastModel.trim() : '';
  if (lastModel) {
    bucket.analytics.lastModel = lastModel.slice(0, 120);
  }

  const lastProvider = typeof delta.lastProvider === 'string' ? delta.lastProvider.trim() : '';
  if (lastProvider) {
    bucket.analytics.lastProvider = lastProvider.slice(0, 60);
  }

  const lastWorkspacePath =
    typeof delta.lastWorkspacePath === 'string' ? delta.lastWorkspacePath.trim() : '';
  if (lastWorkspacePath) {
    bucket.analytics.lastWorkspacePath = lastWorkspacePath.slice(0, 260);
  }
}

export function upsertRuntimeDevice(
  uid: string | null,
  device: {
    id: string;
    name?: string;
    os?: string;
    platform?: string;
    deviceType?: string;
    appVersion?: string;
    active?: boolean;
  },
): void {
  if (!uid || !device.id) {
    return;
  }

  const bucket = getBucket(uid);
  const existing = bucket.devices[device.id];

  const next: RuntimeDevice = {
    id: device.id,
    name: (device.name || existing?.name || 'Unknown Device').slice(0, 120),
    os: (device.os || existing?.os || 'Unknown OS').slice(0, 120),
    platform: (device.platform || existing?.platform || '').slice(0, 40) || undefined,
    deviceType: (device.deviceType || existing?.deviceType || '').slice(0, 30) || undefined,
    appVersion: (device.appVersion || existing?.appVersion || '').slice(0, 40) || undefined,
    lastUsed: Date.now(),
    active: device.active !== undefined ? Boolean(device.active) : existing?.active !== false,
  };

  bucket.devices[device.id] = next;
}

export function deactivateRuntimeDevice(uid: string | null, deviceId: string): void {
  if (!uid || !deviceId) {
    return;
  }

  const bucket = getBucket(uid);
  const existing = bucket.devices[deviceId];
  if (!existing) {
    return;
  }

  bucket.devices[deviceId] = {
    ...existing,
    active: false,
    lastUsed: Date.now(),
  };
}

export function getRuntimeTelemetrySnapshot(uid: string | null): {
  analytics: RuntimeAnalytics;
  devices: RuntimeDevice[];
} {
  if (!uid) {
    return {
      analytics: createEmptyAnalytics(),
      devices: [],
    };
  }

  const bucket = getBucket(uid);
  const devices = Object.values(bucket.devices)
    .filter((device) => device.active !== false)
    .sort((a, b) => b.lastUsed - a.lastUsed);

  return {
    analytics: { ...bucket.analytics },
    devices,
  };
}
