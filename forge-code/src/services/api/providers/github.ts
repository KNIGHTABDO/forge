import type { LLMProvider, ProviderRequest } from './types.js';
import type { Message, StreamEvent, AssistantMessage } from '../../types/message.js';
import { resolveProviderModel } from './models.js';
import { toProviderToolDefinitions } from './schema.js';

export class GitHubProvider implements LLMProvider {
  name = 'github';
  private cache: { token: string; expires_at: number } | null = null;

  async *streamRequest(request: ProviderRequest): AsyncGenerator<StreamEvent | AssistantMessage, void, unknown> {
    const token = await this.getFreshToken();
    const modelId = resolveProviderModel(request.model, 'github');
    const providerTools = toProviderToolDefinitions(request.tools);

    const response = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'GithubCopilot/1.276.0',
      },
      body: JSON.stringify({
        model: modelId,
        messages: this.mapMessagesToOpenAI(request.messages, request.systemPrompt),
        tools: this.mapToolsToOpenAI(providerTools),
        stream: true,
      }),
      signal: request.signal,
    });

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${await response.text()}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    let fullText = '';
    const decoder = new TextDecoder();
    let buffer = '';
    const idleTimeoutMs = Number(process.env.FORGE_CODE_PROVIDER_STREAM_IDLE_TIMEOUT_MS || '90000');
    const toolCallsByIndex = new Map<number, { id: string; name: string; args: string }>();
    let doneSeen = false;
    
    while (!doneSeen) {
        const readPromise = reader.read();
        const { done, value } = await Promise.race([
          readPromise,
          new Promise<{ done: true; value?: undefined }>((_resolve, reject) => {
            setTimeout(() => reject(new Error('GitHub stream timed out while waiting for data.')), idleTimeoutMs);
          }),
        ]);
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') {
              doneSeen = true;
              break;
            }
            
            try {
                const json = JSON.parse(data);
                const delta = json.choices[0]?.delta;
                if (delta?.content) {
                    fullText += delta.content;
                }
                if (Array.isArray(delta?.tool_calls)) {
                  for (const toolCall of delta.tool_calls) {
                    const index = Number(toolCall.index ?? 0);
                    const existing = toolCallsByIndex.get(index) ?? {
                      id: toolCall.id || `github_tool_${index + 1}`,
                      name: toolCall.function?.name || 'tool',
                      args: '',
                    };

                    if (toolCall.id) existing.id = toolCall.id;
                    if (toolCall.function?.name) existing.name = toolCall.function.name;
                    if (toolCall.function?.arguments) {
                      existing.args += toolCall.function.arguments;
                    }

                    toolCallsByIndex.set(index, existing);
                  }
                }
            } catch {
                // Ignore invalid JSON lines; streaming chunks can split across frames.
            }
        }
    }

    const contentBlocks: Array<Record<string, unknown>> = [];
    if (fullText.trim().length > 0) {
      contentBlocks.push({
        type: 'text',
        text: fullText,
      });
    }

    for (const toolCall of toolCallsByIndex.values()) {
      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = toolCall.args ? JSON.parse(toolCall.args) : {};
      } catch {
        parsedInput = {};
      }

      contentBlocks.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.name,
        input: parsedInput,
      });
    }

    if (contentBlocks.length === 0) {
      throw new Error(
        'GitHub provider returned no text or tool calls. Retrying with fallback provider.',
      );
    }

    yield {
        type: 'assistant',
        uuid: crypto.randomUUID(),
        timestamp: Date.now(),
        message: {
            role: 'assistant',
            content: contentBlocks,
            stop_reason: 'end_turn',
            usage: { input_tokens: 0, output_tokens: 0 }
        }
    } as AssistantMessage;
  }

  private async getFreshToken(): Promise<string> {
    if (this.cache && this.cache.expires_at > (Date.now() / 1000) + 60) {
      return this.cache.token;
    }

    const oauthToken = process.env.GITHUB_COPILOT_OAUTH_TOKEN || process.env.GITHUB_TOKEN;
    if (!oauthToken) throw new Error('No GitHub token found.');

    const res = await fetch('https://api.github.com/copilot_internal/v2/token', {
      headers: {
        'Authorization': `Bearer ${oauthToken}`,
        'editor-version': 'vscode/1.98.0',
        'editor-plugin-version': 'GitHub.copilot/1.276.0',
        'user-agent': 'GithubCopilot/1.276.0',
      },
    });

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);

    const data = await res.json();
    this.cache = { token: data.token, expires_at: data.expires_at };
    return data.token;
  }

  private mapMessagesToOpenAI(messages: Message[], systemPrompt: string[]): any[] {
    const result: any[] = [{ role: 'system', content: systemPrompt.join('\n') }];
    
    for (const msg of messages) {
        if (msg.type === 'user') {
            const blocks = Array.isArray(msg.message.content)
              ? msg.message.content
              : [{ type: 'text', text: typeof msg.message.content === 'string' ? msg.message.content : JSON.stringify(msg.message.content) }];

            const textParts: string[] = [];
            for (const block of blocks) {
              if (block.type === 'text') {
                textParts.push(block.text);
              } else if (block.type === 'tool_result') {
                result.push({
                  role: 'tool',
                  tool_call_id: block.tool_use_id,
                  content:
                    typeof block.content === 'string'
                      ? block.content
                      : JSON.stringify(block.content),
                });
              }
            }

            if (textParts.length > 0) {
              result.push({
                role: 'user',
                content: textParts.join('\n'),
              });
            }
        } else if (msg.type === 'assistant') {
            const blocks = Array.isArray(msg.message.content)
              ? msg.message.content
              : [{ type: 'text', text: typeof msg.message.content === 'string' ? msg.message.content : JSON.stringify(msg.message.content) }];
            const textParts: string[] = [];
            const toolCalls: any[] = [];
            for (const block of blocks) {
              if (block.type === 'text') {
                textParts.push(block.text);
              } else if (block.type === 'tool_use') {
                toolCalls.push({
                  id: block.id,
                  type: 'function',
                  function: {
                    name: block.name,
                    arguments: JSON.stringify(block.input ?? {}),
                  },
                });
              }
            }

            result.push({
                role: 'assistant',
                content: textParts.join(''),
                ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
            });
        }
    }
    return result;
  }

  private mapToolsToOpenAI(
    tools: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>,
  ): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description || '',
            parameters: t.parameters || {}
        }
    }));
  }
}




