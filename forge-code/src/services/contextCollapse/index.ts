type CollapseStats = {
  collapsedSpans: number;
  stagedSpans: number;
  health: {
    totalErrors: number;
    totalEmptySpawns: number;
    emptySpawnWarningEmitted: boolean;
  };
};

const stats: CollapseStats = {
  collapsedSpans: 0,
  stagedSpans: 0,
  health: {
    totalErrors: 0,
    totalEmptySpawns: 0,
    emptySpawnWarningEmitted: false,
  },
};

const listeners = new Set<() => void>();

export function getStats(): CollapseStats {
  return stats;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyContextCollapseUpdated(): void {
  for (const listener of listeners) {
    listener();
  }
}
