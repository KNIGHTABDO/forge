import type {
  AssistantMessage,
  Message,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../types/message.js'
import type { Tools } from '../../Tool.js'
import { getProviderCandidatesForModel } from './providers/registry.js'
import type { SystemPrompt } from '../../utils/systemPromptType.js'
import { logForDebugging } from '../../utils/debug.js'
import { getRequestedModelLabel } from './providers/models.js'

export type Options = {
    model: string;
    thinkingConfig?: any;
    signal?: AbortSignal;
    [key: string]: any;
}

export async function* queryModelWithStreaming({
  messages,
  systemPrompt,
  thinkingConfig,
  tools,
  signal,
  options,
}: {
  messages: Message[]
  systemPrompt: SystemPrompt
  thinkingConfig?: any
  tools: Tools
  signal?: AbortSignal
  options: Options
}): AsyncGenerator<
  StreamEvent | AssistantMessage | SystemAPIErrorMessage,
  void
> {
  const providers = getProviderCandidatesForModel(options.model)
  const modelLabel = getRequestedModelLabel(options.model)

  if (providers.length === 0) {
    throw new Error(
      `No provider found for ${modelLabel}. Configure GEMINI_API_KEY and/or GITHUB_TOKEN.`,
    )
  }

  let lastError: unknown = null

  for (const provider of providers) {
    try {
      yield* provider.streamRequest({
        messages,
        systemPrompt,
        tools,
        model: options.model,
        signal,
        thinking: thinkingConfig,
      }) as AsyncGenerator<
        StreamEvent | AssistantMessage | SystemAPIErrorMessage,
        void
      >
      return
    } catch (error) {
      lastError = error
      logForDebugging(
        `[provider:fallback] ${provider.name} failed for requestedModel=${options.model}; trying next candidate if available`,
      )
    }
  }

  const errorMessage =
    lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(
    `All configured providers failed for ${modelLabel}. Last error: ${errorMessage}`,
  )
}




