import { buildTool } from '../../Tool.js';
import { z } from 'zod';

export const SuggestBackgroundPRTool = buildTool({
  name: 'suggest_background_pr',
  description: async () => 'Suggest a background pull request (stub)',
  inputSchema: z.object({}),
  async call() {
    return {
      data: 'SuggestBackgroundPR tool is not available in this build.',
    };
  },
  async renderToolUseMessage() {
    return null;
  },
  maxResultSizeChars: 1000,
});
