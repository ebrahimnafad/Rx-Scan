export const queryKeys = {
  prescriptions: {
    all: () => ['prescriptions', 'all'] as const,
    lists: () => ['prescriptions'] as const, // For specific lists or cards
  },
  queue: {
    scan: (filter: string | null, rxId: string | null) => ['scan', filter, rxId] as const,
    countFilter: (filter: string | null, rxId: string | null) => ['count', 'filter', filter, rxId] as const,
    countSkipped: () => ['count', 'skipped'] as const,
    countAll: () => ['count'] as const,
  },
  settings: {
    all: () => ['settings'] as const,
  },
};
