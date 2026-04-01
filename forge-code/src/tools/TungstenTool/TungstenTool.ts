import { buildTool } from '../../Tool.js';
import { z } from 'zod';

export const TungstenTool = buildTool({
  name: 'tungsten',
  description: async () => 'Tungsten internal tool (stub)',
  inputSchema: z.object({}),
  async call() {
    return {
      data: 'Tungsten tool is not available in this build.',
    };
  },
  async renderToolUseMessage() {
    return null;
  },
  maxResultSizeChars: 1000,
});
