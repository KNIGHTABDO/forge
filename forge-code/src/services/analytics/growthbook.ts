/**
 * src/services/analytics/growthbook.ts
 * Stub for Forge Code feature flags.
 */

export function hasGrowthBookEnvOverride(): boolean {
  return false;
}

export async function initializeGrowthBook(): Promise<void> {
  // No-op
}

export function refreshGrowthBookAfterAuthChange(): void {
  // No-op
}

export function onGrowthBookRefresh(callback: () => void): void {
  // No-op
}

export function resetGrowthBook(): void {
  // No-op
}

export function getFeatureValue_CACHED_MAY_BE_STALE<T>(key: string, defaultValue: T): T {
  return defaultValue;
}

export function getFeatureValue_DEPRECATED<T>(
  _key: string,
  defaultValue: T,
): T {
  return defaultValue;
}

export function checkStatsigFeatureGate_CACHED_MAY_BE_STALE(_key: string): boolean {
  return false;
}

export async function checkGate_CACHED_OR_BLOCKING(
  _key: string,
  defaultValue: boolean,
): Promise<boolean> {
  return defaultValue;
}

export function checkSecurityRestrictionGate(_key: string): boolean {
  return false;
}

export async function getDynamicConfig_BLOCKS_ON_INIT<T>(
  _key: string,
  defaultValue: T,
): Promise<T> {
  return defaultValue;
}

export function getDynamicConfig_CACHED_MAY_BE_STALE<T>(
  _key: string,
  defaultValue: T,
): T {
  return defaultValue;
}

export function getFeatureValue_CACHED_WITH_REFRESH<T>(
  _key: string,
  defaultValue: T,
  _refreshMs: number,
): T {
  return defaultValue;
}



