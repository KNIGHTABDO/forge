import { GeminiProvider } from './gemini.js';
import { GitHubProvider } from './github.js';
import type { LLMProvider } from './types.js';

let registry: Record<string, LLMProvider> | null = null;

export function getProviderRegistry(): Record<string, LLMProvider> {
  if (registry) return registry;

  registry = {};

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    registry['gemini'] = new GeminiProvider(geminiKey);
  }

  const githubToken = process.env.GITHUB_COPILOT_OAUTH_TOKEN || process.env.GITHUB_TOKEN;
  if (githubToken) {
    registry['github'] = new GitHubProvider();
  }

  return registry;
}

export function getProviderForModel(model: string): LLMProvider | null {
  const [first] = getProviderCandidatesForModel(model);
  return first ?? null;
}

export function getProviderCandidatesForModel(model: string): LLMProvider[] {
  const reg = getProviderRegistry();
  const normalized = (model || '').toLowerCase();

  if (normalized.includes('gemini')) {
    return [reg['gemini'], reg['github']].filter(Boolean) as LLMProvider[];
  }

  if (
    normalized.includes('balanced') ||
    normalized.includes('reasoning') ||
    normalized.includes('fast')
  ) {
    // Forge profile terms default to Gemini-first routing with GitHub fallback.
    return [reg['gemini'], reg['github']].filter(Boolean) as LLMProvider[];
  }

  // Route common GitHub-model families through the GitHub provider.
  if (
    normalized.includes('gpt') ||
    normalized.includes('o1') ||
    normalized.includes('o3') ||
    normalized.includes('claude') ||
    normalized.includes('sonnet') ||
    normalized.includes('opus') ||
    normalized.includes('haiku')
  ) {
    return [reg['github'], reg['gemini']].filter(Boolean) as LLMProvider[];
  }

  // Default to Gemini when possible, then GitHub.
  return [reg['gemini'], reg['github']].filter(Boolean) as LLMProvider[];
}




