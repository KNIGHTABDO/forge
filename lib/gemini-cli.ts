import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type GeminiCliToolEvent = {
  name: string;
  status: 'running' | 'done' | 'error';
  detail: string;
};

export type GeminiCliRunOptions = {
  prompt: string;
  apiKey: string;
  model?: string;
  workingDirectory?: string;
  timeoutMs?: number;
};

export type GeminiCliRunResult = {
  ok: boolean;
  reply: string;
  thinking: string[];
  tools: GeminiCliToolEvent[];
  model: string;
  error?: string;
  rawEventCount: number;
  commandSource?: GeminiCliCommandSource;
  command?: string;
};

type JsonRecord = Record<string, unknown>;

export type GeminiCliCommandSource =
  | 'env-command'
  | 'node-modules-bin'
  | 'package-bundle';

export type GeminiCliAvailability = {
  ready: boolean;
  commandSource?: GeminiCliCommandSource;
  command?: string;
  details?: string;
};

type CliCommandSpec = {
  command: string;
  baseArgs: string[];
  source: GeminiCliCommandSource;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function truncate(value: string, maxChars = 320): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}...`;
}

function splitCommandString(value: string): string[] {
  const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return matches.map((entry) => entry.replace(/^"(.*)"$/, '$1'));
}

function looksLikePath(value: string): boolean {
  return /[\\/]/.test(value) || /\.[A-Za-z0-9]+$/.test(value);
}

function summarizeUnknown(value: unknown, maxChars = 320): string {
  if (typeof value === 'string') {
    return truncate(value.trim(), maxChars);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value && typeof value === 'object') {
    try {
      return truncate(JSON.stringify(value), maxChars);
    } catch {
      return '[unserializable object]';
    }
  }

  return '';
}

function extractMessageText(record: JsonRecord): string {
  const direct =
    asNonEmptyString(record.content) ||
    asNonEmptyString(record.delta) ||
    asNonEmptyString(record.text);
  if (direct) {
    return direct;
  }

  const message = record.message;
  if (message && typeof message === 'object') {
    const messageRecord = message as JsonRecord;
    const nested =
      asNonEmptyString(messageRecord.content) ||
      asNonEmptyString(messageRecord.delta) ||
      asNonEmptyString(messageRecord.text);
    if (nested) {
      return nested;
    }
  }

  return '';
}

function extractThinkingText(record: JsonRecord): string {
  const direct =
    asNonEmptyString(record.thinking) ||
    asNonEmptyString(record.reasoning) ||
    asNonEmptyString(record.thought);
  if (direct) {
    return direct;
  }

  const message = record.message;
  if (message && typeof message === 'object') {
    const messageRecord = message as JsonRecord;
    const nested =
      asNonEmptyString(messageRecord.thinking) ||
      asNonEmptyString(messageRecord.reasoning) ||
      asNonEmptyString(messageRecord.thought);
    if (nested) {
      return nested;
    }
  }

  return '';
}

function resolveGeminiCliCommand(): CliCommandSpec | null {
  const configured = (process.env.GEMINI_CLI_COMMAND || '').trim();
  if (configured) {
    const parts = splitCommandString(configured);
    if (parts.length > 0) {
      const command = parts[0];
      if (looksLikePath(command) && !existsSync(command)) {
        return null;
      }

      return {
        command,
        baseArgs: parts.slice(1),
        source: 'env-command',
      };
    }
  }

  const localBinary = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'gemini.cmd' : 'gemini',
  );

  if (existsSync(localBinary)) {
    return {
      command: localBinary,
      baseArgs: [],
      source: 'node-modules-bin',
    };
  }

  const bundledScript = path.join(
    process.cwd(),
    'node_modules',
    '@google',
    'gemini-cli',
    'bundle',
    'gemini.js',
  );

  if (existsSync(bundledScript)) {
    return {
      command: process.execPath,
      baseArgs: [bundledScript],
      source: 'package-bundle',
    };
  }

  return null;
}

export async function checkGeminiCliAvailability(timeoutMs = 4000): Promise<GeminiCliAvailability> {
  const commandSpec = resolveGeminiCliCommand();
  if (!commandSpec) {
    return {
      ready: false,
      details:
        'Gemini CLI command was not found. Install @google/gemini-cli in backend dependencies or set GEMINI_CLI_COMMAND.',
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    let stderr = '';

    const finish = (result: GeminiCliAvailability): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };

    let child;
    try {
      child = spawn(commandSpec.command, [...commandSpec.baseArgs, '--version'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NO_COLOR: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });
    } catch (error) {
      finish({
        ready: false,
        commandSource: commandSpec.source,
        command: commandSpec.command,
        details: `Unable to spawn Gemini CLI command: ${String(error)}`,
      });
      return;
    }

    const timeoutHandle = setTimeout(() => {
      child.kill('SIGKILL');
      finish({
        ready: false,
        commandSource: commandSpec.source,
        command: commandSpec.command,
        details: `Gemini CLI availability check timed out after ${Math.floor(timeoutMs / 1000)}s.`,
      });
    }, Math.min(Math.max(timeoutMs, 1000), 15000));

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString('utf8')}`;
    });

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      finish({
        ready: false,
        commandSource: commandSpec.source,
        command: commandSpec.command,
        details: `Gemini CLI availability check failed: ${String(error)}`,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);

      if (code === 0) {
        finish({
          ready: true,
          commandSource: commandSpec.source,
          command: commandSpec.command,
        });
        return;
      }

      finish({
        ready: false,
        commandSource: commandSpec.source,
        command: commandSpec.command,
        details:
          asNonEmptyString(stderr) ||
          `Gemini CLI availability exited with code ${String(code)}.`,
      });
    });
  });
}

export async function runGeminiCliHeadless(options: GeminiCliRunOptions): Promise<GeminiCliRunResult> {
  const prompt = options.prompt.trim();
  if (!prompt) {
    return {
      ok: false,
      reply: '',
      thinking: [],
      tools: [],
      model: options.model || 'unknown',
      error: 'Prompt cannot be empty.',
      rawEventCount: 0,
    };
  }

  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    return {
      ok: false,
      reply: '',
      thinking: [],
      tools: [],
      model: options.model || 'unknown',
      error: 'Gemini API key is missing for CLI execution.',
      rawEventCount: 0,
    };
  }

  const timeoutMs = Math.min(Math.max(options.timeoutMs || 90000, 5000), 300000);
  const commandSpec = resolveGeminiCliCommand();
  if (!commandSpec) {
    return {
      ok: false,
      reply: '',
      thinking: [],
      tools: [],
      model: options.model || 'unknown',
      error:
        'Gemini CLI command was not found. Install @google/gemini-cli in backend dependencies or set GEMINI_CLI_COMMAND.',
      rawEventCount: 0,
    };
  }

  const { command, baseArgs, source } = commandSpec;

  const args = [
    ...baseArgs,
    '-p',
    prompt,
    '--output-format',
    'stream-json',
  ];

  if (options.model && options.model.trim()) {
    args.push('-m', options.model.trim());
  }

  const cwd = options.workingDirectory?.trim() || process.cwd();

  return new Promise((resolve) => {
    const assistantParts: string[] = [];
    const thinking: string[] = [];
    const toolMap = new Map<string, GeminiCliToolEvent>();

    let finalModel = options.model?.trim() || 'unknown';
    let finalResultResponse = '';
    let rawEventCount = 0;
    let stderrBuffer = '';
    let stdoutBuffer = '';
    let didTimeout = false;
    let autoToolCounter = 0;
    let fatalError: string | null = null;
    let finished = false;

    const finish = (result: GeminiCliRunResult): void => {
      if (finished) {
        return;
      }

      finished = true;
      resolve(result);
    };

    const handleEvent = (record: JsonRecord): void => {
      rawEventCount += 1;

      const eventType =
        asNonEmptyString(record.type) ||
        asNonEmptyString(record.event) ||
        '';

      const eventModel = asNonEmptyString(record.model);
      if (eventModel) {
        finalModel = eventModel;
      }

      if (eventType === 'init') {
        return;
      }

      if (eventType === 'message') {
        const role = (
          asNonEmptyString(record.role) ||
          asNonEmptyString((record.message as JsonRecord | undefined)?.role) ||
          'assistant'
        ).toLowerCase();

        const messageText = extractMessageText(record);
        if (messageText && (!role || role === 'assistant')) {
          assistantParts.push(messageText);
        }

        const thought = extractThinkingText(record);
        if (thought) {
          thinking.push(truncate(thought, 240));
        }

        return;
      }

      if (eventType === 'tool_use') {
        const toolId =
          asNonEmptyString(record.tool_id) ||
          asNonEmptyString(record.id) ||
          `tool-${autoToolCounter++}`;

        const toolName =
          asNonEmptyString(record.tool_name) ||
          asNonEmptyString(record.name) ||
          asNonEmptyString((record.tool as JsonRecord | undefined)?.name) ||
          'tool';

        const toolInput =
          summarizeUnknown(record.parameters) ||
          summarizeUnknown(record.args) ||
          summarizeUnknown(record.input);

        toolMap.set(toolId, {
          name: toolName,
          status: 'running',
          detail: toolInput ? `args: ${toolInput}` : 'Tool started.',
        });

        return;
      }

      if (eventType === 'tool_result') {
        const toolId =
          asNonEmptyString(record.tool_id) ||
          asNonEmptyString(record.id) ||
          `tool-${autoToolCounter++}`;

        const rawStatus = (asNonEmptyString(record.status) || 'done').toLowerCase();
        const status: GeminiCliToolEvent['status'] =
          rawStatus === 'error' || rawStatus === 'failed' ? 'error' : 'done';

        const existing = toolMap.get(toolId);
        const toolName =
          existing?.name ||
          asNonEmptyString(record.tool_name) ||
          asNonEmptyString(record.name) ||
          'tool';

        const outputSummary =
          summarizeUnknown(record.output) ||
          summarizeUnknown(record.result) ||
          summarizeUnknown(record.message) ||
          summarizeUnknown(record.error);

        toolMap.set(toolId, {
          name: toolName,
          status,
          detail:
            outputSummary || (status === 'done' ? 'Tool completed.' : 'Tool failed.'),
        });

        return;
      }

      if (eventType === 'error') {
        const errorMessage =
          asNonEmptyString(record.message) ||
          summarizeUnknown(record.error) ||
          'Gemini CLI reported an error event.';

        fatalError = errorMessage;
        thinking.push(`CLI warning: ${truncate(errorMessage, 220)}`);
        return;
      }

      if (eventType === 'result') {
        const responseText =
          asNonEmptyString(record.response) ||
          asNonEmptyString((record.result as JsonRecord | undefined)?.response) ||
          asNonEmptyString((record.result as JsonRecord | undefined)?.text) ||
          '';

        if (responseText) {
          finalResultResponse = responseText;
        }
      }
    };

    const parseLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return;
        }

        handleEvent(parsed as JsonRecord);
      } catch {
        // Ignore non-JSON lines from CLI.
      }
    };

    const flushStdoutBuffer = (): void => {
      const remaining = stdoutBuffer.trim();
      if (!remaining) {
        stdoutBuffer = '';
        return;
      }

      parseLine(remaining);
      stdoutBuffer = '';
    };

    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env: {
          ...process.env,
          GEMINI_API_KEY: apiKey,
          NO_COLOR: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
      });
    } catch (error) {
      finish({
        ok: false,
        reply: '',
        thinking: [],
        tools: [],
        model: finalModel,
        error: `Unable to start Gemini CLI: ${String(error)}`,
        rawEventCount,
        commandSource: source,
        command,
      });
      return;
    }

    const timeoutHandle = setTimeout(() => {
      didTimeout = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf8');

      let newlineIndex = stdoutBuffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex);
        parseLine(line);
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        newlineIndex = stdoutBuffer.indexOf('\n');
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const piece = chunk.toString('utf8');
      stderrBuffer = `${stderrBuffer}${piece}`;
    });

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      finish({
        ok: false,
        reply: '',
        thinking,
        tools: Array.from(toolMap.values()),
        model: finalModel,
        error: `Gemini CLI process error: ${String(error)}`,
        rawEventCount,
        commandSource: source,
        command,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      flushStdoutBuffer();

      const reply = assistantParts.join('').trim() || finalResultResponse.trim();
      const tools = Array.from(toolMap.values());

      if (didTimeout) {
        finish({
          ok: false,
          reply,
          thinking,
          tools,
          model: finalModel,
          error: `Gemini CLI timed out after ${Math.floor(timeoutMs / 1000)}s.`,
          rawEventCount,
          commandSource: source,
          command,
        });
        return;
      }

      if (code !== 0) {
        const errorText =
          fatalError ||
          asNonEmptyString(stderrBuffer) ||
          `Gemini CLI exited with code ${String(code)}.`;

        finish({
          ok: false,
          reply,
          thinking,
          tools,
          model: finalModel,
          error: errorText,
          rawEventCount,
          commandSource: source,
          command,
        });
        return;
      }

      finish({
        ok: Boolean(reply),
        reply,
        thinking,
        tools,
        model: finalModel,
        error: reply ? undefined : 'Gemini CLI returned no assistant response.',
        rawEventCount,
        commandSource: source,
        command,
      });
    });
  });
}
