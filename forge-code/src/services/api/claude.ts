import { queryModelWithStreaming as queryModelWithStreamingFromForge } from './forge.js'

export function getCacheControl(_options?: { querySource?: string }): any {
  return undefined
}

export function getAPIMetadata(): Record<string, unknown> {
  return {}
}

export function getExtraBodyParams(): Record<string, unknown> {
  return {}
}

export function getMaxOutputTokensForModel(_model: string): number {
  return 4096
}

export function updateUsage(
  currentUsage: Record<string, number> | undefined,
  deltaUsage: Record<string, number> | undefined,
): Record<string, number> {
  const next = { ...(currentUsage ?? {}) }
  if (!deltaUsage) {
    return next
  }
  for (const [key, value] of Object.entries(deltaUsage)) {
    next[key] = (next[key] ?? 0) + (typeof value === 'number' ? value : 0)
  }
  return next
}

export function accumulateUsage(
  left: Record<string, number> | undefined,
  right: Record<string, number> | undefined,
): Record<string, number> {
  return updateUsage(left, right)
}

export async function verifyApiKey(
  apiKey: string | undefined,
  _isNonInteractiveSession: boolean,
): Promise<boolean> {
  return Boolean(apiKey && apiKey.trim().length > 0)
}

export async function* queryModelWithStreaming(params: any): AsyncGenerator<any> {
  yield* queryModelWithStreamingFromForge(params as never)
}

export async function queryModelWithoutStreaming(params: any): Promise<any> {
  const stream = queryModelWithStreaming(params)
  let lastMessage: any = null
  for await (const event of stream) {
    if (event?.type === 'assistant') {
      lastMessage = event
    }
  }

  if (lastMessage) {
    return lastMessage
  }

  return {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text: '' }],
      usage: {},
    },
  }
}

export async function queryWithModel(params: any): Promise<any> {
  return queryModelWithoutStreaming(params)
}

export async function queryHaiku(params: any): Promise<any> {
  return queryModelWithoutStreaming(params)
}
