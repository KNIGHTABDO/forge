import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { mergeRuntimeAnalytics } from '@/lib/runtime-telemetry';

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

function buildFallbackReply(message: string, toolResults: ToolResult[]): string {
  const toolsUsed = toolResults.map((tool) => tool.name).join(', ');
  if (toolsUsed) {
    return `I processed your request: "${message}" and executed these tools: ${toolsUsed}. Model output was unavailable on this turn.`;
  }

  return `I received your request: "${message}". Model output was unavailable on this turn.`;
}

function buildThinking(toolResults: ToolResult[], hints: string[]): string[] {
  const toolInsights = toolResults.map((tool) => `Tool ${tool.name} returned ${tool.output.length} chars of context.`);

  return [
    ...hints.slice(0, 4),
    ...toolInsights.slice(0, 4),
    'Synthesizing response with Forge desktop execution context.',
  ].slice(0, 8);
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
  let verifiedUid: string | null = null;

  try {
    if (process.env.NODE_ENV === 'production') {
      if (!token || !adminAuth) {
        return NextResponse.json(
          { error: 'Missing or invalid authorization context for desktop agent.' },
          { status: 401 },
        );
      }

      try {
        const decoded = await adminAuth.verifyIdToken(token);
        verifiedUid = decoded.uid;
      } catch {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
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
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const message = asTrimmedString(body.message, 5000);
    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const history = normalizeHistory(body.history);
    const toolResults = normalizeToolResults(body.toolResults);
    const thinkingHints = normalizeThinkingHints(body.thinkingHints);
    const workspacePath = asTrimmedString(body.workspacePath, 260) || 'No workspace selected';
    const workspaceLabel = asTrimmedString(body.workspaceLabel, 120) || workspacePath;
    const workspaceFiles = normalizeWorkspaceFiles(body.workspaceFiles);
    const providerPreference = asTrimmedString(body.providerPreference, 40) || 'gemini';
    const modelPreference = asTrimmedString(body.modelPreference, 80);
    const payloadGeminiApiKey = asTrimmedString(body.geminiApiKey, 400);

    const fallbackModelName = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
    const modelName = modelPreference || fallbackModelName;

    const apiKey = payloadGeminiApiKey || process.env.GEMINI_API_KEY;
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
          'No Gemini API key is configured for this desktop session. Sync a key or configure GEMINI_API_KEY on the server.',
      }, { status: 503 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

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

    let reply = '';
    let resolvedModelName = modelName;

    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      reply = result.response.text().trim();
    } catch {
      if (modelName !== fallbackModelName) {
        const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName });
        const result = await fallbackModel.generateContent(prompt);
        reply = result.response.text().trim();
        resolvedModelName = fallbackModelName;
      } else {
        throw new Error(`Unable to generate model output for ${modelName}`);
      }
    }

    void recordDesktopAgentUsage(verifiedUid, {
      modelName: resolvedModelName,
      providerName: providerPreference,
      workspacePath,
      toolCalls: toolResults.length,
      failedTurn: false,
    });

    return NextResponse.json({
      reply: reply || buildFallbackReply(message, toolResults),
      thinking: buildThinking(toolResults, thinkingHints),
    });
  } catch (error) {
    void recordDesktopAgentUsage(verifiedUid, {
      modelName: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview',
      providerName: 'gemini',
      workspacePath: 'Unknown workspace',
      toolCalls: 0,
      failedTurn: true,
    });

    return NextResponse.json(
      {
        error: 'Failed to run desktop agent chat',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
