import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  checkGeminiCliAvailability,
  runGeminiCliHeadless,
  type GeminiCliToolEvent,
} from '@/lib/gemini-cli';
import { mergeRuntimeAnalytics } from '@/lib/runtime-telemetry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ToolResult = {
  name: string;
  output: string;
};

type AgentUsageMetrics = {
  modelName: string;
  providerName: string;
  workspacePath: string;
  toolCalls: number;
  failedTurn: boolean;
};

function getRequestId(request: Request): string {
  const provided =
    request.headers.get('x-correlation-id') ||
    request.headers.get('X-Correlation-Id') ||
    request.headers.get('x-request-id') ||
    request.headers.get('X-Request-Id');

  const normalized = (provided || '').trim();
  return normalized || crypto.randomUUID();
}

function getBearerToken(request: Request): string | null {
  const authHeader =
    request.headers.get('authorization') || request.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const token = match[1].trim();
  return token || null;
}

function asTrimmedString(value: unknown, maxLength = 1200): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const role = record.role === 'assistant' ? 'assistant' : 'user';
      const content = asTrimmedString(record.content, 4000);

      if (!content) {
        return null;
      }

      return { role, content } satisfies ChatMessage;
    })
    .filter((entry): entry is ChatMessage => Boolean(entry))
    .slice(-10);
}

function normalizeToolResults(value: unknown): ToolResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const name = asTrimmedString(record.name, 120);
      const output = asTrimmedString(record.output, 4000);

      if (!name || !output) {
        return null;
      }

      return { name, output } satisfies ToolResult;
    })
    .filter((entry): entry is ToolResult => Boolean(entry))
    .slice(0, 12);
}

function normalizeThinkingHints(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asTrimmedString(entry, 200))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeWorkspaceFiles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 120);
}

function decodeUidFromJwtWithoutVerification(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      sub?: unknown;
      user_id?: unknown;
      uid?: unknown;
    };

    if (typeof decoded.user_id === 'string' && decoded.user_id.trim()) {
      return decoded.user_id.trim();
    }

    if (typeof decoded.uid === 'string' && decoded.uid.trim()) {
      return decoded.uid.trim();
    }

    if (typeof decoded.sub === 'string' && decoded.sub.trim()) {
      return decoded.sub.trim();
    }

    return null;
  } catch {
    return null;
  }
}

async function recordDesktopAgentUsage(uid: string | null, metrics: AgentUsageMetrics): Promise<void> {
  if (!uid) {
    return;
  }

  mergeRuntimeAnalytics(uid, {
    commandsExecuted: 1,
    messagesSent: 1,
    assistantResponses: 1,
    toolCalls: Math.max(0, metrics.toolCalls),
    failedTurns: metrics.failedTurn ? 1 : 0,
    lastModel: metrics.modelName,
    lastProvider: metrics.providerName,
    lastWorkspacePath: metrics.workspacePath,
  });

  if (!adminDb) {
    return;
  }

  try {
    const userRef = adminDb.collection('users').doc(uid);
    const analyticsRef = userRef.collection('analytics').doc('current');

    await analyticsRef.set(
      {
        commandsExecuted: admin.firestore.FieldValue.increment(1),
        messagesSent: admin.firestore.FieldValue.increment(1),
        assistantResponses: admin.firestore.FieldValue.increment(1),
        toolCalls: admin.firestore.FieldValue.increment(Math.max(0, metrics.toolCalls)),
        failedTurns: admin.firestore.FieldValue.increment(metrics.failedTurn ? 1 : 0),
        lastModel: metrics.modelName,
        lastProvider: metrics.providerName,
        lastWorkspacePath: metrics.workspacePath,
        lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Desktop agent usage telemetry warning:', error);
  }
}

function buildThinking(toolResults: ToolResult[], hints: string[]): string[] {
  const toolInsights = toolResults.map((tool) => `Tool ${tool.name} returned ${tool.output.length} chars of context.`);

  return [
    ...hints.slice(0, 4),
    ...toolInsights.slice(0, 4),
    'Synthesizing response with Forge desktop execution context.',
  ].slice(0, 8);
}

function mergeThinking(baseThinking: string[], modelThinking: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const item of [...baseThinking, ...modelThinking]) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    merged.push(normalized);

    if (merged.length >= 16) {
      break;
    }
  }

  return merged;
}

function deriveCliExecutionErrorCode(details: string): string {
  const normalized = details.toLowerCase();

  if (normalized.includes('quota') || normalized.includes('429')) {
    return 'GEMINI_API_QUOTA_EXCEEDED';
  }

  if (
    normalized.includes('invalid api key') ||
    normalized.includes('unauthorized') ||
    normalized.includes('permission denied') ||
    normalized.includes('401') ||
    normalized.includes('403')
  ) {
    return 'GEMINI_API_AUTH_FAILED';
  }

  if (normalized.includes('timed out')) {
    return 'GEMINI_CLI_TIMEOUT';
  }

  return 'GEMINI_CLI_EXECUTION_FAILED';
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const token = getBearerToken(request);
  let verifiedUid: string | null = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!/application\/json/i.test(contentType)) {
      return NextResponse.json(
        {
          error: 'Expected application/json request body.',
          errorCode: 'INVALID_CONTENT_TYPE',
          requestId,
        },
        { status: 415 },
      );
    }

    if (process.env.NODE_ENV === 'production') {
      if (!token || !adminAuth) {
        return NextResponse.json(
          {
            error: 'Missing or invalid authorization context for desktop agent.',
            errorCode: 'AUTH_REQUIRED',
            requestId,
          },
          { status: 401 },
        );
      }

      try {
        const decoded = await adminAuth.verifyIdToken(token);
        verifiedUid = decoded.uid;
      } catch {
        return NextResponse.json(
          { error: 'Invalid or expired token', errorCode: 'AUTH_INVALID', requestId },
          { status: 401 },
        );
      }
    } else if (token && adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        verifiedUid = decoded.uid;
      } catch {
        verifiedUid = decodeUidFromJwtWithoutVerification(token);
      }
    } else if (token) {
      verifiedUid = decodeUidFromJwtWithoutVerification(token);
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload', errorCode: 'INVALID_JSON', requestId },
        { status: 400 },
      );
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'JSON body must be an object.', errorCode: 'INVALID_BODY', requestId },
        { status: 400 },
      );
    }

    const message = asTrimmedString(body.message, 5000);
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required.', errorCode: 'MESSAGE_REQUIRED', requestId },
        { status: 400 },
      );
    }

    const history = normalizeHistory(body.history);
    const toolResults = normalizeToolResults(body.toolResults);
    const thinkingHints = normalizeThinkingHints(body.thinkingHints);
    const workspacePath = asTrimmedString(body.workspacePath, 260) || 'No workspace selected';
    const workspaceLabel = asTrimmedString(body.workspaceLabel, 120) || workspacePath;
    const workspaceFiles = normalizeWorkspaceFiles(body.workspaceFiles);
    const providerPreference = asTrimmedString(body.providerPreference, 40) || 'gemini';
    const modelPreference = asTrimmedString(body.modelPreference, 80);

    const modelName = modelPreference || process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      void recordDesktopAgentUsage(verifiedUid, {
        modelName,
        providerName: providerPreference,
        workspacePath,
        toolCalls: toolResults.length,
        failedTurn: true,
      });

      return NextResponse.json({
        error:
          'No Gemini API key is configured on the server for desktop agent execution.',
        errorCode: 'GEMINI_KEY_MISSING',
        requestId,
      }, { status: 503 });
    }

    const cliAvailability = await checkGeminiCliAvailability(5000);
    if (!cliAvailability.ready) {
      void recordDesktopAgentUsage(verifiedUid, {
        modelName,
        providerName: 'gemini-cli',
        workspacePath,
        toolCalls: toolResults.length,
        failedTurn: true,
      });

      return NextResponse.json(
        {
          error: 'Gemini CLI is not available on backend runtime.',
          errorCode: 'GEMINI_CLI_UNAVAILABLE',
          details: cliAvailability.details || 'CLI availability check failed.',
          ...(cliAvailability.commandSource ? { commandSource: cliAvailability.commandSource } : {}),
          ...(cliAvailability.command ? { command: cliAvailability.command } : {}),
          requestId,
        },
        { status: 503 },
      );
    }

    const historyBlock = history
      .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
      .join('\n');

    const toolBlock = toolResults
      .map((tool) => `TOOL ${tool.name}: ${tool.output}`)
      .join('\n\n');

    const prompt = [
      'You are Forge Desktop Agent, a practical coding assistant for local desktop workflows.',
      'Use the provided tool outputs as ground truth and be direct.',
      'A workspace is already selected. Do not ask user to provide a path again if workspace context is available.',
      'If tool data is missing for a request, state what to run next and prefer /index or /read guidance only when needed.',
      'Keep responses concise but useful, with action-oriented steps.',
      '',
      'Selected provider:',
      providerPreference,
      '',
      'Selected model:',
      modelName,
      '',
      'Workspace path:',
      workspacePath,
      '',
      'Workspace label:',
      workspaceLabel,
      '',
      'Workspace file hints:',
      workspaceFiles.length > 0 ? workspaceFiles.join('\n') : '[none indexed]',
      '',
      'Conversation history:',
      historyBlock || '[none]',
      '',
      'Latest user request:',
      message,
      '',
      'Tool outputs:',
      toolBlock || '[none]',
      '',
      'Respond to the latest user request now.',
    ].join('\n');

    const cliResult = await runGeminiCliHeadless({
      prompt,
      apiKey,
      model: modelName,
      timeoutMs: 120000,
    });

    const modelToolEvents: GeminiCliToolEvent[] = cliResult.tools;
    const modelThinking: string[] = cliResult.thinking;
    const reply = cliResult.reply.trim();

    if (!cliResult.ok || !reply) {
      const details =
        cliResult.error ||
        'Gemini CLI failed to produce a usable assistant response.';
      const errorCode = deriveCliExecutionErrorCode(details);

      void recordDesktopAgentUsage(verifiedUid, {
        modelName,
        providerName: 'gemini-cli',
        workspacePath,
        toolCalls: toolResults.length + modelToolEvents.length,
        failedTurn: true,
      });

      return NextResponse.json(
        {
          error: 'Gemini CLI execution failed',
          errorCode,
          details,
          toolEvents: modelToolEvents,
          engine: 'gemini-cli',
          ...(cliResult.commandSource ? { commandSource: cliResult.commandSource } : {}),
          ...(cliResult.command ? { command: cliResult.command } : {}),
          requestId,
        },
        { status: 502 },
      );
    }

    const resolvedModelName = cliResult.model || modelName;

    const mergedThinking = mergeThinking(buildThinking(toolResults, thinkingHints), modelThinking);
    const effectiveToolCalls = toolResults.length + modelToolEvents.length;

    void recordDesktopAgentUsage(verifiedUid, {
      modelName: resolvedModelName,
      providerName: 'gemini-cli',
      workspacePath,
      toolCalls: effectiveToolCalls,
      failedTurn: false,
    });

    return NextResponse.json({
      reply,
      thinking: mergedThinking,
      toolEvents: modelToolEvents,
      engine: 'gemini-cli',
      ...(cliResult.commandSource ? { commandSource: cliResult.commandSource } : {}),
      requestId,
    });
  } catch (error) {
    void recordDesktopAgentUsage(verifiedUid, {
      modelName: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview',
      providerName: 'gemini-cli',
      workspacePath: 'Unknown workspace',
      toolCalls: 0,
      failedTurn: true,
    });

    return NextResponse.json(
      {
        error: 'Failed to run desktop agent chat',
        errorCode: 'UNHANDLED_DESKTOP_AGENT_ERROR',
        details: String(error),
        requestId,
      },
      { status: 500 },
    );
  }
}
