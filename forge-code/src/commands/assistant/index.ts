import type { Command } from '../../commands.js';

const assistant = {
  type: 'local-jsx',
  name: 'assistant',
  description: 'Manage assistant sessions',
  load: () => import('./assistant.js'),
} satisfies Command;

export default assistant;
