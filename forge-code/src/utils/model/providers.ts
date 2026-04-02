import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'
import { isEnvTruthy } from '../envUtils.js'

export type APIProvider = 'firstParty' | 'bedrock' | 'vertex' | 'foundry' | 'openai' | 'gemini'

function hasNonEmptyValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function getAPIProvider(): APIProvider {
  // Explicit provider switches always win.
  if (isEnvTruthy(process.env.FORGE_CODE_USE_GEMINI)) return 'gemini'
  if (isEnvTruthy(process.env.FORGE_CODE_USE_OPENAI)) return 'openai'
  if (isEnvTruthy(process.env.FORGE_CODE_USE_BEDROCK)) return 'bedrock'
  if (isEnvTruthy(process.env.FORGE_CODE_USE_VERTEX)) return 'vertex'
  if (isEnvTruthy(process.env.FORGE_CODE_USE_FOUNDRY)) return 'foundry'

  // Auto-detect a sensible provider from injected credentials.
  if (
    hasNonEmptyValue(process.env.GEMINI_API_KEY) ||
    hasNonEmptyValue(process.env.GOOGLE_API_KEY)
  ) {
    return 'gemini'
  }

  if (
    hasNonEmptyValue(process.env.OPENAI_API_KEY) ||
    hasNonEmptyValue(process.env.GITHUB_TOKEN)
  ) {
    return 'openai'
  }

  // Forge default: Gemini-first when no explicit provider configuration exists.
  return 'gemini'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

/**
 * Check if ANTHROPIC_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.anthropic.com
 * (or api-staging.anthropic.com for ant users).
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host
    const allowedHosts = ['api.anthropic.com']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com')
    }
    return allowedHosts.includes(host)
  } catch {
    return false
  }
}
