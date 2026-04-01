import {
  DEFAULT_CODEX_BASE_URL,
  DEFAULT_OPENAI_BASE_URL,
  isCodexBaseUrl,
  resolveCodexApiCredentials,
  resolveProviderRequest,
} from '../services/api/providerConfig.ts'
import {
  getGoalDefaultOpenAIModel,
  type RecommendationGoal,
} from './providerRecommendation.ts'

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai'
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite-preview'

export type ProviderProfile = 'openai' | 'ollama' | 'codex' | 'gemini' | 'github'

export type ProfileEnv = {
  GITHUB_TOKEN?: string
  GITHUB_MODEL?: string
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
  OPENAI_API_KEY?: string
  CODEX_API_KEY?: string
  CHATGPT_ACCOUNT_ID?: string
  CODEX_ACCOUNT_ID?: string
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  GEMINI_BASE_URL?: string
}

export type ProfileFile = {
  profile: ProviderProfile
  env: ProfileEnv
  createdAt: string
}

export function sanitizeApiKey(
  key: string | null | undefined,
): string | undefined {
  if (!key || key === 'SUA_CHAVE') return undefined
  return key
}

export function buildOllamaProfileEnv(
  model: string,
  options: {
    baseUrl?: string | null
    getOllamaChatBaseUrl: (baseUrl?: string) => string
  },
): ProfileEnv {
  return {
    OPENAI_BASE_URL: options.getOllamaChatBaseUrl(options.baseUrl ?? undefined),
    OPENAI_MODEL: model,
  }
}

export function buildGeminiProfileEnv(options: {
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const key = sanitizeApiKey(
    options.apiKey ??
      processEnv.GEMINI_API_KEY ??
      processEnv.GOOGLE_API_KEY,
  )
  if (!key) {
    return null
  }

  const env: ProfileEnv = {
    GEMINI_MODEL:
      options.model || processEnv.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    GEMINI_API_KEY: key,
  }

  const baseUrl = options.baseUrl || processEnv.GEMINI_BASE_URL
  if (baseUrl) {
    env.GEMINI_BASE_URL = baseUrl
  }

  return env
}

export function buildGithubProfileEnv(options: {
  goal?: RecommendationGoal
} = {}): ProfileEnv {
  return {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    GITHUB_MODEL: process.env.GITHUB_MODEL || 'gpt-4o',
    OPENAI_BASE_URL: 'https://models.inference.ai.azure.com',
    OPENAI_MODEL: process.env.GITHUB_MODEL || 'gpt-4o',
    OPENAI_API_KEY: process.env.GITHUB_TOKEN || '',
  }
}

export function buildOpenAIProfileEnv(options: {
  goal: RecommendationGoal
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const key = sanitizeApiKey(options.apiKey ?? processEnv.OPENAI_API_KEY)
  if (!key) {
    return null
  }

  const defaultModel = getGoalDefaultOpenAIModel(options.goal)
  const shellOpenAIRequest = resolveProviderRequest({
    model: processEnv.OPENAI_MODEL,
    baseUrl: processEnv.OPENAI_BASE_URL,
    fallbackModel: defaultModel,
  })
  const useShellOpenAIConfig = shellOpenAIRequest.transport === 'chat_completions'

  return {
    OPENAI_BASE_URL:
      options.baseUrl ||
      (useShellOpenAIConfig ? processEnv.OPENAI_BASE_URL : undefined) ||
      DEFAULT_OPENAI_BASE_URL,
    OPENAI_MODEL:
      options.model ||
      (useShellOpenAIConfig ? processEnv.OPENAI_MODEL : undefined) ||
      defaultModel,
    OPENAI_API_KEY: key,
  }
}

export function buildCodexProfileEnv(options: {
  model?: string | null
  baseUrl?: string | null
  apiKey?: string | null
  processEnv?: NodeJS.ProcessEnv
}): ProfileEnv | null {
  const processEnv = options.processEnv ?? process.env
  const key = sanitizeApiKey(options.apiKey ?? processEnv.CODEX_API_KEY)
  const credentialEnv = key
    ? ({ ...processEnv, CODEX_API_KEY: key } as NodeJS.ProcessEnv)
    : processEnv
  const credentials = resolveCodexApiCredentials(credentialEnv)
  if (!credentials.apiKey || !credentials.accountId) {
    return null
  }

  const env: ProfileEnv = {
    OPENAI_BASE_URL: options.baseUrl || DEFAULT_CODEX_BASE_URL,
    OPENAI_MODEL: options.model || 'codexplan',
  }

  if (key) {
    env.CODEX_API_KEY = key
  }

  env.CHATGPT_ACCOUNT_ID = credentials.accountId

  return env
}

export function createProfileFile(
  profile: ProviderProfile,
  env: ProfileEnv,
): ProfileFile {
  return {
    profile,
    env,
    createdAt: new Date().toISOString(),
  }
}

export function selectAutoProfile(
  recommendedOllamaModel: string | null,
): ProviderProfile {
  return recommendedOllamaModel ? 'ollama' : 'openai'
}

export async function buildLaunchEnv(options: {
  profile: ProviderProfile
  persisted: ProfileFile | null
  goal: RecommendationGoal
  processEnv?: NodeJS.ProcessEnv
  getOllamaChatBaseUrl?: (baseUrl?: string) => string
  resolveOllamaDefaultModel?: (goal: RecommendationGoal) => Promise<string>
}): Promise<NodeJS.ProcessEnv> {
  const processEnv = options.processEnv ?? process.env

  // Automatically siphon web app keys without user configuration overhead
  const fs = require('fs');
  const path = require('path');
  for (const envFile of ['../.env.local', '.env']) {
    const rawPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(rawPath)) {
      const content = fs.readFileSync(rawPath, 'utf-8');
      content.split('\n').forEach((line: string) => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
            value = value.replace(/\\n/gm, '\n');
          }
          value = value.replace(/(^['"]|['"]$)/g, '').trim();
          if (!processEnv[key]) {
            processEnv[key] = value;
          }
        }
      });
    }
  }

  const persistedEnv =
    options.persisted?.profile === options.profile
      ? options.persisted.env ?? {}
      : {}

  const shellGeminiKey = sanitizeApiKey(
    processEnv.GEMINI_API_KEY ?? processEnv.GOOGLE_API_KEY,
  )
  const persistedGeminiKey = sanitizeApiKey(persistedEnv.GEMINI_API_KEY)

  if (options.profile === 'github') {
    const shellGithubKey = processEnv.GITHUB_COPILOT_OAUTH_TOKEN || processEnv.GITHUB_TOKEN || processEnv.GITHUB_API_KEY || ''
    
    let inferenceToken = shellGithubKey;
    try {
      // Fetch Copilot internal token natively matching our web app architecture
      if (shellGithubKey && (shellGithubKey.startsWith('ghp_') || shellGithubKey.startsWith('gho_'))) {
        const res = await fetch('https://api.github.com/copilot_internal/v2/token', {
          headers: {
            'Authorization': `Bearer ${shellGithubKey}`,
            'editor-version': 'vscode/1.98.0',
            'editor-plugin-version': 'GitHub.copilot/1.276.0',
            'copilot-integration-id': 'vscode-chat',
            'user-agent': 'GithubCopilot/1.276.0',
            'Accept': 'application/json',
          },
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            inferenceToken = data.token;
          }
        }
      }
    } catch (e) {
      console.error('[github-profile] Error obtaining native Copilot token:', e);
    }

    const env: NodeJS.ProcessEnv = {
      ...processEnv,
      FORGE_CODE_PROVIDER: 'openai',
      FORGE_CODE_USE_OPENAI: '1',
      OPENAI_API_KEY: inferenceToken,
      OPENAI_BASE_URL: 'https://api.githubcopilot.com',
      OPENAI_MODEL: processEnv.GITHUB_MODEL || 'gemini-3.1-pro-preview',
      ANTHROPIC_CUSTOM_HEADERS: 'editor-version: vscode/1.98.0\neditor-plugin-version: GitHub.copilot/1.276.0\ncopilot-integration-id: vscode-chat',
    }
    return env
  }

  if (options.profile === 'gemini') {
    const env: NodeJS.ProcessEnv = {
      ...processEnv,
      FORGE_CODE_USE_GEMINI: '1',
    }

    delete env.FORGE_CODE_USE_OPENAI

    env.GEMINI_MODEL =
      processEnv.GEMINI_MODEL ||
      persistedEnv.GEMINI_MODEL ||
      DEFAULT_GEMINI_MODEL
    env.GEMINI_BASE_URL =
      processEnv.GEMINI_BASE_URL ||
      persistedEnv.GEMINI_BASE_URL ||
      DEFAULT_GEMINI_BASE_URL

    const geminiKey = shellGeminiKey || persistedGeminiKey
    if (geminiKey) {
      env.GEMINI_API_KEY = geminiKey
    } else {
      delete env.GEMINI_API_KEY
    }

    delete env.GOOGLE_API_KEY
    delete env.OPENAI_BASE_URL
    delete env.OPENAI_MODEL
    delete env.OPENAI_API_KEY
    delete env.CODEX_API_KEY
    delete env.CHATGPT_ACCOUNT_ID
    delete env.CODEX_ACCOUNT_ID

    return env
  }

  const env: NodeJS.ProcessEnv = {
    ...processEnv,
    FORGE_CODE_USE_OPENAI: '1',
  }

  delete env.FORGE_CODE_USE_GEMINI
  delete env.GEMINI_API_KEY
  delete env.GEMINI_MODEL
  delete env.GEMINI_BASE_URL
  delete env.GOOGLE_API_KEY

  if (options.profile === 'ollama') {
    const getOllamaBaseUrl =
      options.getOllamaChatBaseUrl ?? (() => 'http://localhost:11434/v1')
    const resolveOllamaModel =
      options.resolveOllamaDefaultModel ?? (async () => 'llama3.1:8b')

    env.OPENAI_BASE_URL = persistedEnv.OPENAI_BASE_URL || getOllamaBaseUrl()
    env.OPENAI_MODEL =
      persistedEnv.OPENAI_MODEL ||
      (await resolveOllamaModel(options.goal))

    delete env.OPENAI_API_KEY
    delete env.CODEX_API_KEY
    delete env.CHATGPT_ACCOUNT_ID
    delete env.CODEX_ACCOUNT_ID

    return env
  }

  if (options.profile === 'codex') {
    env.OPENAI_BASE_URL =
      persistedEnv.OPENAI_BASE_URL && isCodexBaseUrl(persistedEnv.OPENAI_BASE_URL)
        ? persistedEnv.OPENAI_BASE_URL
        : DEFAULT_CODEX_BASE_URL
    env.OPENAI_MODEL = persistedEnv.OPENAI_MODEL || 'codexplan'
    delete env.OPENAI_API_KEY

    const codexKey =
      sanitizeApiKey(processEnv.CODEX_API_KEY) ||
      sanitizeApiKey(persistedEnv.CODEX_API_KEY)
    const liveCodexCredentials = resolveCodexApiCredentials(processEnv)
    const codexAccountId =
      processEnv.CHATGPT_ACCOUNT_ID ||
      processEnv.CODEX_ACCOUNT_ID ||
      liveCodexCredentials.accountId ||
      persistedEnv.CHATGPT_ACCOUNT_ID ||
      persistedEnv.CODEX_ACCOUNT_ID
    if (codexKey) {
      env.CODEX_API_KEY = codexKey
    } else {
      delete env.CODEX_API_KEY
    }

    if (codexAccountId) {
      env.CHATGPT_ACCOUNT_ID = codexAccountId
    } else {
      delete env.CHATGPT_ACCOUNT_ID
    }
    delete env.CODEX_ACCOUNT_ID

    return env
  }

  const defaultOpenAIModel = getGoalDefaultOpenAIModel(options.goal)
  const shellOpenAIRequest = resolveProviderRequest({
    model: processEnv.OPENAI_MODEL,
    baseUrl: processEnv.OPENAI_BASE_URL,
    fallbackModel: defaultOpenAIModel,
  })
  const persistedOpenAIRequest = resolveProviderRequest({
    model: persistedEnv.OPENAI_MODEL,
    baseUrl: persistedEnv.OPENAI_BASE_URL,
    fallbackModel: defaultOpenAIModel,
  })
  const useShellOpenAIConfig = shellOpenAIRequest.transport === 'chat_completions'
  const usePersistedOpenAIConfig =
    (!persistedEnv.OPENAI_MODEL && !persistedEnv.OPENAI_BASE_URL) ||
    persistedOpenAIRequest.transport === 'chat_completions'

  env.OPENAI_BASE_URL =
    (useShellOpenAIConfig ? processEnv.OPENAI_BASE_URL : undefined) ||
    (usePersistedOpenAIConfig ? persistedEnv.OPENAI_BASE_URL : undefined) ||
    DEFAULT_OPENAI_BASE_URL
  env.OPENAI_MODEL =
    (useShellOpenAIConfig ? processEnv.OPENAI_MODEL : undefined) ||
    (usePersistedOpenAIConfig ? persistedEnv.OPENAI_MODEL : undefined) ||
    defaultOpenAIModel
  env.OPENAI_API_KEY = processEnv.OPENAI_API_KEY || persistedEnv.OPENAI_API_KEY
  delete env.CODEX_API_KEY
  delete env.CHATGPT_ACCOUNT_ID
  delete env.CODEX_ACCOUNT_ID
  return env
}
