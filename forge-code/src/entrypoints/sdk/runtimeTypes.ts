export type AnyZodRawShape = Record<string, unknown>;
export type InferShape<T> = T extends Record<string, unknown> ? T : never;

export type ForkSessionOptions = Record<string, unknown>;
export type ForkSessionResult = Record<string, unknown>;
export type GetSessionInfoOptions = Record<string, unknown>;
export type GetSessionMessagesOptions = Record<string, unknown>;
export type InternalOptions = Record<string, unknown>;
export type InternalQuery = Record<string, unknown>;
export type ListSessionsOptions = Record<string, unknown>;
export type McpSdkServerConfigWithInstance = Record<string, unknown>;
export type Options = Record<string, unknown>;
export type Query = Record<string, unknown>;
export type SDKSession = Record<string, unknown>;
export type SDKSessionOptions = Record<string, unknown>;
export type SdkMcpToolDefinition<Schema = unknown> = {
  name?: string;
  description?: string;
  inputSchema?: Schema;
};
export type SessionMessage = Record<string, unknown>;
export type SessionMutationOptions = Record<string, unknown>;
