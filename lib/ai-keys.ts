
// lib/ai-keys.ts
// Smart Google API Key rotation system for Forge

const RAW_KEYS = process.env.GEMINI_API_KEYS || "";
const KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(Boolean);
export const ALL_KEYS = KEYS;
export const KEYS_COUNT = KEYS.length;

// In-memory cache of failed keys and their last failure time
const failedKeys = new Map<string, number>();
const FAILURE_COOLDOWN = 1000 * 60 * 5; // 5 minutes cooldown for a failed key

let lastWorkingKeyIndex = 0;

export function getSmartGeminiKey(): string {
  if (KEYS.length === 0) {
    throw new Error('No GEMINI_API_KEYS found in environment variables.');
  }

  const now = Date.now();
  
  // Clean up old failure marks
  for (const [key, timestamp] of failedKeys.entries()) {
    if (now - timestamp > FAILURE_COOLDOWN) {
      failedKeys.delete(key);
    }
  }

  // Try to find a working key, starting from the last working one
  for (let i = 0; i < KEYS.length; i++) {
    const idx = (lastWorkingKeyIndex + i) % KEYS.length;
    const key = KEYS[idx];
    
    if (!failedKeys.has(key)) {
      lastWorkingKeyIndex = idx;
      return key;
    }
  }

  // If ALL keys are marked as failed, reset the failure cache and return the first one
  console.warn('[Keys] All API keys have failed recently. Resetting failure cache.');
  failedKeys.clear();
  return KEYS[0];
}

export function reportKeyFailure(key: string) {
  console.error(`[Keys] API key failed: ${key.substring(0, 10)}... Marks for cooldown.`);
  failedKeys.set(key, Date.now());
}

export function reportKeySuccess(key: string) {
  // If a key works, we can potentially lower its failure count if we had one
  if (failedKeys.has(key)) {
    failedKeys.delete(key);
  }
}
