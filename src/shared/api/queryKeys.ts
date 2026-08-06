export const queryKeys = {
  prescriptions: {
    all: () => ['prescriptions', 'all'] as const,
    lists: () => ['prescriptions'] as const, // For specific lists or cards
  },
  queue: {
    scan: (filter: string | null, rxId: string | null, sort: string | null = null, dir: string | null = null, q: string | null = null) => ['scan', filter, rxId, sort, dir, q] as const,
    scanAll: () => ['scan'] as const,
    countFilter: (filter: string | null, rxId: string | null, sort: string | null = null, dir: string | null = null, q: string | null = null) => ['count', 'filter', filter, rxId, sort, dir, q] as const,
    countSkipped: () => ['count', 'skipped'] as const,
    countAll: () => ['count'] as const,
  },
  settings: {
    all: () => ['settings'] as const,
  },
};
