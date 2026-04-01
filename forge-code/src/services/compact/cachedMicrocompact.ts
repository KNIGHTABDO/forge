type CachedMCConfig = {
  triggerThreshold: number;
  keepRecent: number;
};

export type CacheEditsBlock = {
  type: 'cache_edits';
  deleted_tool_ids: string[];
};

export type PinnedCacheEdits = {
  userMessageIndex: number;
  block: CacheEditsBlock;
};

export type CachedMCState = {
  toolOrder: string[];
  deletedRefs: Set<string>;
  registeredTools: Set<string>;
  pinnedEdits: PinnedCacheEdits[];
};

export function isCachedMicrocompactEnabled(): boolean {
  return false;
}

export function isModelSupportedForCacheEditing(_model: string): boolean {
  return false;
}

export function getCachedMCConfig(): CachedMCConfig {
  return {
    triggerThreshold: 20,
    keepRecent: 2,
  };
}

export function createCachedMCState(): CachedMCState {
  return {
    toolOrder: [],
    deletedRefs: new Set<string>(),
    registeredTools: new Set<string>(),
    pinnedEdits: [],
  };
}

export function registerToolResult(state: CachedMCState, toolUseId: string): void {
  if (!state.registeredTools.has(toolUseId)) {
    state.registeredTools.add(toolUseId);
    state.toolOrder.push(toolUseId);
  }
}

export function registerToolMessage(_state: CachedMCState, _groupIds: string[]): void {
  // No-op in fork.
}

export function getToolResultsToDelete(_state: CachedMCState): string[] {
  return [];
}

export function createCacheEditsBlock(
  _state: CachedMCState,
  toolsToDelete: string[],
): CacheEditsBlock | null {
  if (toolsToDelete.length === 0) {
    return null;
  }

  return {
    type: 'cache_edits',
    deleted_tool_ids: toolsToDelete,
  };
}
