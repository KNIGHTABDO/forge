/**
 * src/services/analytics/index.ts
 * Stub for Forge Code. All telemetry is disabled or redirected to internal stubs.
 */

export function logEvent(name: string, properties?: any) {
  // Pure no-op for privacy
}

export function logError(error: any) {
  console.error('[Forge Error]', error);
}

export async function getDynamicConfig_BLOCKS_ON_INIT<T>(key: string, defaultValue: T): Promise<T> {
  return defaultValue;
}

export function getFeatureValue_CACHED_MAY_BE_STALE<T>(key: string, defaultValue: T): T {
  return defaultValue;
}

export type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS = string;




