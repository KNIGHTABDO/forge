import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminAuth } from '@/lib/firebase-admin';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ToolResult = {
  name: string;
  output: string;
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

function buildFallbackReply(message: string, toolResults: ToolResult[]): string {
  const toolsUsed = toolResults.map((tool) => tool.name).join(', ');
  if (toolsUsed) {
    return `I processed your request: "${message}" and executed these tools: ${toolsUsed}. Configure GEMINI_API_KEY to enable model-generated answers.`;
  }

  return `I received your request: "${message}". Configure GEMINI_API_KEY to enable model-generated answers.`;
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
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

    if (process.env.NODE_ENV === 'production') {
      if (!token || !adminAuth) {
        return NextResponse.json(
          { error: 'Missing or invalid authorization context for desktop agent.' },
          { status: 401 },
        );
      }

      try {
        await adminAuth.verifyIdToken(token);
      } catch {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
      }
    } else if (token && adminAuth) {
      try {
        await adminAuth.verifyIdToken(token);
      } catch {
        // In development mode, invalid tokens do not block local testing.
      }
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: buildFallbackReply(message, toolResults),
        thinking: buildThinking(toolResults, thinkingHints),
      });
    }

    const modelName = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const historyBlock = history
      .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
      .join('\n');

    const toolBlock = toolResults
      .map((tool) => `TOOL ${tool.name}: ${tool.output}`)
      .join('\n\n');

    const prompt = [
      'You are Forge Desktop Agent, a practical coding assistant for local desktop workflows.',
      'Use the provided tool outputs as ground truth and be direct.',
      'If tool data is missing for a request, state what to run next.',
      'Keep responses concise but useful, with action-oriented steps.',
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

    const result = await model.generateContent(prompt);
    const reply = result.response.text().trim();

    return NextResponse.json({
      reply: reply || buildFallbackReply(message, toolResults),
      thinking: buildThinking(toolResults, thinkingHints),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to run desktop agent chat',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
