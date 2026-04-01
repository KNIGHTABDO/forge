// Content for the Forge-api bundled skill.
// Each .md file is inlined as a string at build time via Bun's text loader.

import csharpClaudeApi from './Forge-api/csharp/Forge-api.md'
import curlExamples from './Forge-api/curl/examples.md'
import goClaudeApi from './Forge-api/go/Forge-api.md'
import javaClaudeApi from './Forge-api/java/Forge-api.md'
import phpClaudeApi from './Forge-api/php/Forge-api.md'
import pythonAgentSdkPatterns from './Forge-api/python/agent-sdk/patterns.md'
import pythonAgentSdkReadme from './Forge-api/python/agent-sdk/README.md'
import pythonClaudeApiBatches from './Forge-api/python/Forge-api/batches.md'
import pythonClaudeApiFilesApi from './Forge-api/python/Forge-api/files-api.md'
import pythonClaudeApiReadme from './Forge-api/python/Forge-api/README.md'
import pythonClaudeApiStreaming from './Forge-api/python/Forge-api/streaming.md'
import pythonClaudeApiToolUse from './Forge-api/python/Forge-api/tool-use.md'
import rubyClaudeApi from './Forge-api/ruby/Forge-api.md'
import skillPrompt from './Forge-api/SKILL.md'
import sharedErrorCodes from './Forge-api/shared/error-codes.md'
import sharedLiveSources from './Forge-api/shared/live-sources.md'
import sharedModels from './Forge-api/shared/models.md'
import sharedPromptCaching from './Forge-api/shared/prompt-caching.md'
import sharedToolUseConcepts from './Forge-api/shared/tool-use-concepts.md'
import typescriptAgentSdkPatterns from './Forge-api/typescript/agent-sdk/patterns.md'
import typescriptAgentSdkReadme from './Forge-api/typescript/agent-sdk/README.md'
import typescriptClaudeApiBatches from './Forge-api/typescript/Forge-api/batches.md'
import typescriptClaudeApiFilesApi from './Forge-api/typescript/Forge-api/files-api.md'
import typescriptClaudeApiReadme from './Forge-api/typescript/Forge-api/README.md'
import typescriptClaudeApiStreaming from './Forge-api/typescript/Forge-api/streaming.md'
import typescriptClaudeApiToolUse from './Forge-api/typescript/Forge-api/tool-use.md'

// @[MODEL LAUNCH]: Update the model IDs/names below. These are substituted into {{VAR}}
// placeholders in the .md files at runtime before the skill prompt is sent.
// After updating these constants, manually update the two files that still hardcode models:
//   - Forge-api/SKILL.md (Current Models pricing table)
//   - Forge-api/shared/models.md (full model catalog with legacy versions and alias mappings)
export const SKILL_MODEL_VARS = {
  OPUS_ID: 'Forge-opus-4-6',
  OPUS_NAME: 'Forge Opus 4.6',
  SONNET_ID: 'Forge-sonnet-4-6',
  SONNET_NAME: 'Forge Sonnet 4.6',
  HAIKU_ID: 'Forge-haiku-4-5',
  HAIKU_NAME: 'Forge Haiku 4.5',
  // Previous Sonnet ID — used in "do not append date suffixes" example in SKILL.md.
  PREV_SONNET_ID: 'Forge-sonnet-4-5',
} satisfies Record<string, string>

export const SKILL_PROMPT: string = skillPrompt

export const SKILL_FILES: Record<string, string> = {
  'csharp/Forge-api.md': csharpClaudeApi,
  'curl/examples.md': curlExamples,
  'go/Forge-api.md': goClaudeApi,
  'java/Forge-api.md': javaClaudeApi,
  'php/Forge-api.md': phpClaudeApi,
  'python/agent-sdk/README.md': pythonAgentSdkReadme,
  'python/agent-sdk/patterns.md': pythonAgentSdkPatterns,
  'python/Forge-api/README.md': pythonClaudeApiReadme,
  'python/Forge-api/batches.md': pythonClaudeApiBatches,
  'python/Forge-api/files-api.md': pythonClaudeApiFilesApi,
  'python/Forge-api/streaming.md': pythonClaudeApiStreaming,
  'python/Forge-api/tool-use.md': pythonClaudeApiToolUse,
  'ruby/Forge-api.md': rubyClaudeApi,
  'shared/error-codes.md': sharedErrorCodes,
  'shared/live-sources.md': sharedLiveSources,
  'shared/models.md': sharedModels,
  'shared/prompt-caching.md': sharedPromptCaching,
  'shared/tool-use-concepts.md': sharedToolUseConcepts,
  'typescript/agent-sdk/README.md': typescriptAgentSdkReadme,
  'typescript/agent-sdk/patterns.md': typescriptAgentSdkPatterns,
  'typescript/Forge-api/README.md': typescriptClaudeApiReadme,
  'typescript/Forge-api/batches.md': typescriptClaudeApiBatches,
  'typescript/Forge-api/files-api.md': typescriptClaudeApiFilesApi,
  'typescript/Forge-api/streaming.md': typescriptClaudeApiStreaming,
  'typescript/Forge-api/tool-use.md': typescriptClaudeApiToolUse,
}
