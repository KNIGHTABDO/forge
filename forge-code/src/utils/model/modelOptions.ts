import { getGlobalConfig } from '../config.js'
import {
  getDefaultMainLoopModelSetting,
  renderDefaultModelSetting,
  type ModelSetting,
} from './model.js'
import { getAPIProvider } from './providers.js'

const DEFAULT_GEMINI_FLASH_LITE = 'gemini-3.1-flash-lite-preview'
const DEFAULT_GEMINI_PRO = 'gemini-3.1-pro-preview'

export type ModelOption = {
  value: ModelSetting
  label: string
  description: string
  descriptionForModel?: string
}

const GEMINI_FLASH_LITE_OPTION: ModelOption = {
  value: DEFAULT_GEMINI_FLASH_LITE,
  label: 'Gemini 3.1 Flash Lite Preview',
  description: 'Default Forge model · fast and cost-efficient',
  descriptionForModel:
    'Gemini 3.1 Flash Lite Preview - default Forge model for everyday tasks',
}

const GEMINI_PRO_OPTION: ModelOption = {
  value: DEFAULT_GEMINI_PRO,
  label: 'Gemini 3.1 Pro Preview',
  description: 'Most capable reasoning model',
  descriptionForModel:
    'Gemini 3.1 Pro Preview - strongest reasoning model for complex tasks',
}

const GEMINI_FLASH_OPTION: ModelOption = {
  value: 'gemini-3.1-flash-preview',
  label: 'Gemini 3.1 Flash Preview',
  description: 'Balanced speed and quality',
  descriptionForModel:
    'Gemini 3.1 Flash Preview - balanced model for interactive coding loops',
}

const GEMINI_25_PRO_OPTION: ModelOption = {
  value: 'gemini-2.5-pro-preview-03-25',
  label: 'Gemini 2.5 Pro Preview',
  description: 'High-quality fallback for legacy compatibility',
}

const GITHUB_GEMINI_PRO_OPTION: ModelOption = {
  value: 'google/gemini-3.1-pro-preview',
  label: 'GitHub Models · Gemini 3.1 Pro Preview',
  description: 'Gemini 3.1 Pro via GitHub Models compatible endpoint',
}

const GITHUB_GEMINI_FLASH_LITE_OPTION: ModelOption = {
  value: 'google/gemini-3.1-flash-lite-preview',
  label: 'GitHub Models · Gemini 3.1 Flash Lite Preview',
  description: 'Gemini 3.1 Flash Lite via GitHub Models compatible endpoint',
}

function dedupeModelOptions(options: ModelOption[]): ModelOption[] {
  const deduped: ModelOption[] = []
  const seen = new Set<string>()

  for (const option of options) {
    const key = option.value === null ? '__default__' : String(option.value)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(option)
  }

  return deduped
}

function getGeminiOptionsBase(): ModelOption[] {
  const options: ModelOption[] = [
    GEMINI_FLASH_LITE_OPTION,
    GEMINI_PRO_OPTION,
    GEMINI_FLASH_OPTION,
    GEMINI_25_PRO_OPTION,
    {
      value: 'gemini-2.0-flash',
      label: 'Gemini 2.0 Flash',
      description: 'Fast and reliable general-purpose model',
    },
    {
      value: 'gemini-2.0-flash-lite',
      label: 'Gemini 2.0 Flash Lite',
      description: 'Lightweight and low-latency model',
    },
  ]

  // OpenAI-compatible routes (such as GitHub Models) often use provider/model prefixes.
  if (getAPIProvider() === 'openai') {
    options.push(GITHUB_GEMINI_PRO_OPTION, GITHUB_GEMINI_FLASH_LITE_OPTION)
  }

  return options
}

export function getDefaultOptionForUser(_fastMode = false): ModelOption {
  const currentModel = renderDefaultModelSetting(getDefaultMainLoopModelSetting())
  return {
    value: null,
    label: 'Default (recommended)',
    description: `Use the default model (currently ${currentModel})`,
    descriptionForModel: `Default model (currently ${currentModel})`,
  }
}

// Legacy export names are kept for compatibility with older imports.
export function getSonnet46_1MOption(): ModelOption {
  return GEMINI_FLASH_OPTION
}

export function getOpus46_1MOption(_fastMode = false): ModelOption {
  return GEMINI_PRO_OPTION
}

export function getMaxSonnet46_1MOption(): ModelOption {
  return GEMINI_FLASH_LITE_OPTION
}

export function getMaxOpus46_1MOption(_fastMode = false): ModelOption {
  return GEMINI_PRO_OPTION
}

export function getModelOptions(_fastMode = false): ModelOption[] {
  const options: ModelOption[] = [getDefaultOptionForUser(), ...getGeminiOptionsBase()]

  const envCustomModel =
    process.env.GEMINI_CUSTOM_MODEL_OPTION ||
    process.env.ANTHROPIC_CUSTOM_MODEL_OPTION

  if (envCustomModel) {
    options.push({
      value: envCustomModel,
      label:
        process.env.GEMINI_CUSTOM_MODEL_OPTION_NAME ||
        process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME ||
        envCustomModel,
      description:
        process.env.GEMINI_CUSTOM_MODEL_OPTION_DESCRIPTION ||
        process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION ||
        `Custom model (${envCustomModel})`,
    })
  }

  for (const opt of getGlobalConfig().additionalModelOptionsCache ?? []) {
    options.push(opt)
  }

  return dedupeModelOptions(options)
}