import { buildTool } from '../../Tool.js';
import { z } from 'zod';

export const SleepTool = buildTool({
  name: 'sleep',
  description: async () => 'Sleep for a specified duration (stub)',
  inputSchema: z.object({
    duration: z.string().describe('Duration to sleep'),
  }),
  async call() {
    return {
      data: 'Sleep tool is not available in this build.',
    };
  },
  maxResultSizeChars: 1000,
});
