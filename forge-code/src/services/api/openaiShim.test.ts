import { afterEach, beforeEach, expect, test } from 'bun:test'
import { createOpenAIShimClient } from './openaiShim.ts'

type FetchType = typeof globalThis.fetch

const originalEnv = {
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
}

const originalFetch = globalThis.fetch

function makeSseResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const line of lines) {
          controller.enqueue(encoder.encode(line))
        }
        controller.close()
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    },
  )
}

function makeStreamChunks(chunks: unknown[]): string[] {
  return [
    ...chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`),
    'data: [DONE]\n\n',
  ]
}

beforeEach(() => {
  process.env.OPENAI_BASE_URL = 'http://example.test/v1'
  process.env.OPENAI_API_KEY = 'test-key'
})

afterEach(() => {
  process.env.OPENAI_BASE_URL = originalEnv.OPENAI_BASE_URL
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY
  globalThis.fetch = originalFetch
})

test('preserves usage from final OpenAI stream chunk with empty choices', async () => {
  globalThis.fetch = (async (_input, init) => {
    const url = typeof _input === 'string' ? _input : _input.url
    expect(url).toBe('http://example.test/v1/chat/completions')

    const body = JSON.parse(String(init?.body))
    expect(body.stream).toBe(true)
    expect(body.stream_options).toEqual({ include_usage: true })

    const chunks = makeStreamChunks([
      {
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        model: 'fake-model',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: 'hello world' },
            finish_reason: null,
          },
        ],
      },
      {
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        model: 'fake-model',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      },
      {
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        model: 'fake-model',
        choices: [],
        usage: {
          prompt_tokens: 123,
          completion_tokens: 45,
          total_tokens: 168,
        },
      },
    ])

    return makeSseResponse(chunks)
  }) as FetchType

  const client = createOpenAIShimClient({}) as {
    beta: {
      messages: {
        create: (
          params: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => Promise<unknown> & {
          withResponse: () => Promise<{ data: AsyncIterable<Record<string, unknown>> }>
        }
      }
    }
  }

  const result = await client.beta.messages
    .create({
      model: 'fake-model',
      system: 'test system',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 64,
      stream: true,
    })
    .withResponse()

  const events: Array<Record<string, unknown>> = []
  for await (const event of result.data) {
    events.push(event)
  }

  const usageEvent = events.find(
    event => event.type === 'message_delta' && typeof event.usage === 'object' && event.usage !== null,
  ) as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined

  expect(usageEvent).toBeDefined()
  expect(usageEvent?.usage?.input_tokens).toBe(123)
  expect(usageEvent?.usage?.output_tokens).toBe(45)
})

test('preserves provider tool-call metadata on roundtrip', async () => {
  let capturedBody: Record<string, unknown> | null = null

  globalThis.fetch = (async (_input, init) => {
    const url = typeof _input === 'string' ? _input : _input.url
    expect(url).toBe('http://example.test/v1/chat/completions')

    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>

    return new Response(
      JSON.stringify({
        id: 'chatcmpl-roundtrip',
        model: 'fake-model',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'done',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }) as FetchType

  const client = createOpenAIShimClient({}) as {
    beta: {
      messages: {
        create: (params: Record<string, unknown>) => Promise<unknown>
      }
    }
  }

  await client.beta.messages.create({
    model: 'fake-model',
    system: 'test system',
    messages: [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'call_read_1',
            name: 'Read',
            input: { file_path: 'README.md' },
            openai_tool_call: {
              id: 'call_read_1',
              type: 'function',
              function: {
                thought_signature: 'sig_test_123',
              },
            },
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call_read_1',
            content: 'ok',
          },
        ],
      },
    ],
    max_tokens: 64,
    stream: false,
  })

  expect(capturedBody).toBeDefined()
  const messages = (capturedBody?.messages ?? []) as Array<Record<string, unknown>>
  const assistantMessage = messages.find(msg => msg.role === 'assistant') as
    | Record<string, unknown>
    | undefined
  expect(assistantMessage).toBeDefined()

  const toolCalls = (assistantMessage?.tool_calls ?? []) as Array<Record<string, unknown>>
  expect(toolCalls.length).toBeGreaterThan(0)

  const firstCall = toolCalls[0] ?? {}
  const fn = (firstCall.function ?? {}) as Record<string, unknown>
  expect(fn.thought_signature).toBe('sig_test_123')
})
