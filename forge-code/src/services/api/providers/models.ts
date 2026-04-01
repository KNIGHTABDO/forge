export type ForgeProfile = 'balanced' | 'reasoning' | 'fast';
export type ProviderName = 'gemini' | 'github';

function inferProfile(input: string): ForgeProfile | null {
  const model = input.toLowerCase();
  if (model.includes('reasoning') || model.includes('o1') || model.includes('o3')) {
    return 'reasoning';
  }
  if (model.includes('fast') || model.includes('mini') || model.includes('haiku')) {
    return 'fast';
  }
  if (model.includes('balanced') || model.includes('sonnet') || model.includes('default')) {
    return 'balanced';
  }
  return null;
}

function isLikelyConcreteModelId(input: string): boolean {
  const model = input.toLowerCase();
  return (
    model.includes('gemini-') ||
    model.includes('gpt-') ||
    model.includes('claude-') ||
    model.includes('o1') ||
    model.includes('o3')
  );
}

const GEMINI_DEFAULTS: Record<ForgeProfile, string> = {
  balanced:
    process.env.FORGE_CODE_GEMINI_BALANCED_MODEL ??
    'gemini-3.1-flash-lite-preview',
  reasoning:
    process.env.FORGE_CODE_GEMINI_REASONING_MODEL ??
    'gemini-3.1-pro-preview',
  fast:
    process.env.FORGE_CODE_GEMINI_FAST_MODEL ??
    'gemini-3.1-flash-lite-preview',
};

const GITHUB_DEFAULTS: Record<ForgeProfile, string> = {
  balanced:
    process.env.FORGE_CODE_GITHUB_BALANCED_MODEL ??
    'gemini-3.1-pro-preview',
  reasoning:
    process.env.FORGE_CODE_GITHUB_REASONING_MODEL ??
    'gemini-3.1-pro-preview',
  fast:
    process.env.FORGE_CODE_GITHUB_FAST_MODEL ??
    'gemini-3.1-pro-preview',
};

export type ProviderModelPickerOption = {
  value: string;
  label: string;
  description: string;
};

export function getProviderModelPickerOptions(): ProviderModelPickerOption[] {
  return [
    {
      value: GEMINI_DEFAULTS.balanced,
      label: 'Gemini 3.1 Flash Lite (Google)',
      description: 'Forge web default · low-latency generation',
    },
    {
      value: GEMINI_DEFAULTS.reasoning,
      label: 'Gemini 3.1 Pro (Google)',
      description: 'Google reasoning model · deeper analysis',
    },
    {
      value: GITHUB_DEFAULTS.balanced,
      label: 'Gemini 3.1 Pro (GitHub)',
      description: 'GitHub provider default used by Forge web fallback',
    },
  ];
}

export function getRequestedModelLabel(requestedModel: string): string {
  const normalized = (requestedModel || '').trim().toLowerCase();
  if (!normalized) return 'Balanced profile';

  const profile = inferProfile(normalized);
  if (profile === 'balanced') return 'Balanced profile';
  if (profile === 'reasoning') return 'Reasoning profile';
  if (profile === 'fast') return 'Fast profile';

  if (
    normalized.includes('sonnet') ||
    normalized.includes('default') ||
    normalized.includes('claude-sonnet')
  ) {
    return 'Balanced profile';
  }
  if (normalized.includes('opus') || normalized.includes('claude-opus')) {
    return 'Reasoning profile';
  }
  if (normalized.includes('haiku') || normalized.includes('claude-haiku')) {
    return 'Fast profile';
  }

  return requestedModel;
}

export function resolveProviderModel(
  requestedModel: string,
  provider: ProviderName,
  thinkingType?: 'enabled' | 'disabled' | 'adaptive',
): string {
  const normalized = (requestedModel || '').trim().toLowerCase();
  if (!normalized) {
    return provider === 'gemini' ? GEMINI_DEFAULTS.balanced : GITHUB_DEFAULTS.balanced;
  }

  if (isLikelyConcreteModelId(normalized) && !['balanced', 'reasoning', 'fast'].includes(normalized)) {
    if (provider === 'gemini' && normalized.includes('gemini-')) {
      return requestedModel;
    }
    if (
      provider === 'github' &&
      (normalized.includes('gpt-') ||
        normalized.includes('o1') ||
        normalized.includes('o3') ||
        normalized.includes('claude-'))
    ) {
      return requestedModel;
    }
  }

  const profile = inferProfile(normalized) ?? 'balanced';
  if (provider === 'gemini') {
    if (thinkingType === 'enabled') {
      return GEMINI_DEFAULTS.reasoning;
    }
    return GEMINI_DEFAULTS[profile];
  }

  return GITHUB_DEFAULTS[profile];
}