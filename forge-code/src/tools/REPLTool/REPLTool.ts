import { buildTool } from '../../Tool.js';
import { z } from 'zod';

export const REPL_TOOL_NAME = 'repl';

export const REPLTool = buildTool({
  name: REPL_TOOL_NAME,
  description: async () => 'Start an interactive REPL session (stub)',
  inputSchema: z.object({
    command: z.string().optional().describe('Initial command to run'),
  }),
  async call() {
    return {
      data: 'REPL tool is not available in this build.',
    };
  },
  async renderToolUseMessage() {
    return null;
  },
  maxResultSizeChars: 1000,
});
