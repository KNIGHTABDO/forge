export function sanitizeToolNameForAnalytics(toolName: string): string {
  return toolName.trim().slice(0, 200);
}

export function isToolDetailsLoggingEnabled(): boolean {
  return false;
}

export function extractToolInputForTelemetry(input: unknown): unknown {
  return input;
}

export function getFileExtensionForAnalytics(filePath: string): string {
  const idx = filePath.lastIndexOf('.');
  return idx >= 0 ? filePath.slice(idx + 1).toLowerCase() : 'none';
}

export function getFileExtensionsFromBashCommand(_command: string): string[] {
  return [];
}

export function extractSkillName(input: unknown): string | undefined {
  if (typeof input === 'string' && input.trim().length > 0) {
    return input.trim();
  }
  return undefined;
}

export function extractMcpToolDetails(_input: unknown): Record<string, unknown> {
  return {};
}

export function mcpToolDetailsForAnalytics(_details: unknown): Record<string, unknown> {
  return {};
}
