import type { 
  Message, 
  StreamEvent, 
  AssistantMessage,
  UserMessage 
} from '../../types/message.js';
import type { Tools } from '../../Tool.js';

import type { SystemPrompt } from '../../../utils/systemPromptType.js';

export interface ProviderRequest {
  messages: Message[];
  systemPrompt: SystemPrompt;
  tools: Tools;
  model: string;
  signal?: AbortSignal;
  thinking?: {
    type: 'enabled' | 'disabled' | 'adaptive';
    budget_tokens?: number;
  };
}

export interface LLMProvider {
  name: string;
  streamRequest(request: ProviderRequest): AsyncGenerator<StreamEvent | AssistantMessage | UserMessage, void, unknown>;
}

export type ProviderRegistry = Record<string, LLMProvider>;




