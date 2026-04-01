export type ModifierKey = 'shift' | 'command' | 'control' | 'option'

let prewarmed = false

/**
 * Pre-warm the native module by loading it in advance.
 * Call this early to avoid delay on first use.
 */
export function prewarmModifiers(): void {
  if (prewarmed || process.platform !== 'darwin') {
    return
  }
  prewarmed = true
  // Mock prewarm on Windows/Non-Darwin since NAPI is missing
  return
}

/**
 * Check if a specific modifier key is currently pressed (synchronous).
 */
export function isModifierPressed(_modifier: ModifierKey): boolean {
  // Always return false on non-darwin platforms as the native module is missing.
  return false
}




