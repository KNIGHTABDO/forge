export type MessageRole = 'user' | 'assistant' | 'system';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | any[];
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  type: 'user' | 'assistant' | 'system' | 'attachment' | 'tombstone' | 'tool_use_summary';
  uuid: string;
  timestamp: number;
  message: {
    role: MessageRole;
    content: any;
    stop_reason?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  apiError?: string;
}

export interface UserMessage extends Message {
  type: 'user';
  sourceToolAssistantUUID?: string;
  toolUseResult?: string;
}

export interface AssistantMessage extends Message {
  type: 'assistant';
}

export interface AttachmentMessage extends Message {
  type: 'attachment';
}

export interface StreamEvent {
  type: 'stream_request_start' | 'stream_request_end' | 'tombstone' | 'progress';
  message?: Message;
}

export interface RequestStartEvent {
  type: 'stream_request_start';
}

export interface TombstoneMessage extends Message {
  type: 'tombstone';
  message: Message;
}

export interface ToolUseSummaryMessage extends Message {
  type: 'tool_use_summary';
}

export interface SystemAPIErrorMessage extends Message {
  type: 'system';
  error: {
    type: string;
    message: string;
  };
}




