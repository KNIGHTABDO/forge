import { buildTool } from '../../Tool.js';
import { z } from 'zod';

export const VerifyPlanExecutionTool = buildTool({
  name: 'verify_plan_execution',
  description: async () => 'Verify the execution of a plan (stub)',
  inputSchema: z.object({}),
  async call() {
    return {
      data: 'VerifyPlanExecution tool is not available in this build.',
    };
  },
  async renderToolUseMessage() {
    return null;
  },
  maxResultSizeChars: 1000,
});
