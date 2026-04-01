import { GoogleGenerativeAI, type Content, type Part, type Tool as GeminiTool } from '@google/generative-ai';
import type { LLMProvider, ProviderRequest } from './types.js';
import type { Message, StreamEvent, AssistantMessage } from '../../types/message.js';
import { env } from '../../utils/env.js';
import {
    sanitizeGeminiToolDefinitions,
    toProviderToolDefinitions,
    validateGeminiToolDefinitions,
} from './schema.js';
import { resolveProviderModel } from './models.js';

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async *streamRequest(request: ProviderRequest): AsyncGenerator<StreamEvent | AssistantMessage, void, unknown> {
        const modelId = resolveProviderModel(
            request.model,
            'gemini',
            request.thinking?.type,
        );

        const providerTools = sanitizeGeminiToolDefinitions(
            toProviderToolDefinitions(request.tools),
        );
        const validationIssues = validateGeminiToolDefinitions(providerTools);
        if (validationIssues.length > 0) {
            const details = validationIssues
                .map(issue => `${issue.toolName}: ${issue.issue}`)
                .join('; ');
            throw new Error(
                `Gemini tool schema preflight validation failed. ${details}. ` +
                    'Check tool parameter schemas for unsupported keys and ensure parameters.type=object.',
            );
        }

    const model = this.genAI.getGenerativeModel({
      model: modelId,
            tools: this.mapToolsToGemini(providerTools),
    });

    const history = this.mapMessagesToGemini(request.messages, request.systemPrompt);
    const chat = model.startChat({
        history: history.slice(0, -1),
    });

    const lastMessage = history[history.length - 1];
    if (!lastMessage) throw new Error('No messages provided');

    const result = await chat.sendMessageStream(lastMessage.parts);

    let fullText = '';
        const toolCalls = new Map<string, { name: string; input: Record<string, unknown> }>();
    for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
            fullText += text;
        }

                const chunkCalls = (chunk as any).functionCalls?.() ?? [];
                for (const call of chunkCalls) {
                    const id =
                        (typeof call.id === 'string' && call.id) ||
                        `gemini_tool_${toolCalls.size + 1}`;
                    const args =
                        call.args && typeof call.args === 'object' && !Array.isArray(call.args)
                            ? (call.args as Record<string, unknown>)
                            : {};
                    if (typeof call.name === 'string' && call.name) {
                        toolCalls.set(id, {
                            name: call.name,
                            input: args,
                        });
                    }
                }
    }

        const finalResponse = await result.response;
        const finalCalls = (finalResponse as any)?.functionCalls?.() ?? [];
        for (const call of finalCalls) {
            const id =
                (typeof call.id === 'string' && call.id) ||
                `gemini_tool_${toolCalls.size + 1}`;
            const args =
                call.args && typeof call.args === 'object' && !Array.isArray(call.args)
                    ? (call.args as Record<string, unknown>)
                    : {};
            if (typeof call.name === 'string' && call.name && !toolCalls.has(id)) {
                toolCalls.set(id, {
                    name: call.name,
                    input: args,
                });
            }
        }

        const contentBlocks: Array<Record<string, unknown>> = [];
        if (fullText.trim().length > 0) {
            contentBlocks.push({
                type: 'text',
                text: fullText,
            });
        }

        for (const [id, call] of toolCalls.entries()) {
            contentBlocks.push({
                type: 'tool_use',
                id,
                name: call.name,
                input: call.input,
            });
        }

        if (contentBlocks.length === 0) {
            throw new Error(
                'Gemini returned no text or tool calls. Retrying with fallback provider.',
            );
        }

    // After finish, yield the final assistant message
    yield {
        type: 'assistant',
        uuid: crypto.randomUUID(),
        timestamp: Date.now(),
        message: {
            role: 'assistant',
                        content: contentBlocks,
            stop_reason: 'end_turn',
            usage: {
                input_tokens: 0, // Need actual usage if possible
                output_tokens: 0,
            }
        }
    } as AssistantMessage;
  }

    private mapMessagesToGemini(messages: Message[], systemPrompt: string[]): Content[] {
    const contents: Content[] = [];
        const toolNamesById = new Map<string, string>();
    
    // System prompt as first message if possible (Gemini handles systemInstruction separately in getGenerativeModel, but we can also prepend)
    // Actually, it's better to use systemInstruction.
    
    for (const msg of messages) {
        if (msg.type === 'user') {
                        const blocks = Array.isArray(msg.message.content)
                            ? msg.message.content
                            : [{ type: 'text', text: typeof msg.message.content === 'string' ? msg.message.content : JSON.stringify(msg.message.content) }];
                        const parts: Part[] = [];
                        const functionResponses: Array<{
                            role: string;
                            parts: Part[];
                        }> = [];
                        for (const block of blocks) {
                            if (block.type === 'text') {
                                parts.push({ text: block.text });
                            } else if (block.type === 'tool_result') {
                                const name = toolNamesById.get(block.tool_use_id) ?? 'tool';
                                functionResponses.push({
                                    role: 'function',
                                    parts: [
                                        {
                                            functionResponse: {
                                                name,
                                                response: {
                                                    result:
                                                        typeof block.content === 'string'
                                                            ? block.content
                                                            : JSON.stringify(block.content),
                                                },
                                            },
                                        } as any,
                                    ],
                                });
                            }
                        }
                        if (parts.length === 0) {
                            parts.push({ text: '' });
                        }
            contents.push({
                role: 'user',
                                parts,
            });
                        for (const functionResponse of functionResponses) {
                            contents.push(functionResponse as any);
                        }
        } else if (msg.type === 'assistant') {
            contents.push({
                role: 'model',
                parts: msg.message.content.map(c => {
                    if (c.type === 'text') return { text: c.text };
                                        if (c.type === 'tool_use') {
                                            if (typeof c.id === 'string' && typeof c.name === 'string') {
                                                toolNamesById.set(c.id, c.name);
                                            }
                                            return {
                                                    functionCall: {
                                                            name: c.name,
                                                            args: c.input as Record<string, any>
                                                    }
                                            };
                                        }
                    return { text: '' };
                })
            });
        }
    }
    return contents;
  }

    private mapToolsToGemini(
        tools: Array<{
            name: string;
            description: string;
            parameters: Record<string, unknown>;
        }>,
    ): GeminiTool[] {
        if (!tools || tools.length === 0) {
            return [];
        }

    return [{
        functionDeclarations: tools.map(t => ({
            name: t.name,
            description: t.description || '',
                        parameters: t.parameters as any
        }))
    }];
  }
}




