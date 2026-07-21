// shared/api/mutations.ts
// Centralized query invalidation after mutations.
// Replaces sweep invalidation with targeted key-based invalidation.

import type { QueryClient } from '@tanstack/react-query';

export type MutationType =
  | 'scanAction'
  | 'noteChange'
  | 'notificationReset'
  | 'sync'
  | 'importJson';

/**
 * After a mutation, invalidate only the query keys that are actually affected.
 * Each mutation type maps to the specific queries that need fresh data.
 */
export async function invalidateAfterMutation(
  qc: QueryClient,
  type: MutationType
): Promise<void> {
  switch (type) {
    case 'scanAction':
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['prescriptions', 'all'] }),
        qc.invalidateQueries({ queryKey: ['scan'] }),
        qc.invalidateQueries({ queryKey: ['count'] }),
      ]);
      break;

    case 'noteChange':
      await qc.invalidateQueries({ queryKey: ['prescriptions', 'all'] });
      break;

    case 'notificationReset':
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['prescriptions', 'all'] }),
        qc.invalidateQueries({ queryKey: ['count'] }),
      ]);
      break;

    case 'sync':
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['prescriptions', 'all'] }),
        qc.invalidateQueries({ queryKey: ['scan'] }),
        qc.invalidateQueries({ queryKey: ['count'] }),
        qc.invalidateQueries({ queryKey: ['settings'] }),
      ]);
      break;

    case 'importJson':
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['prescriptions', 'all'] }),
        qc.invalidateQueries({ queryKey: ['settings'] }),
        qc.invalidateQueries({ queryKey: ['count'] }),
        qc.invalidateQueries({ queryKey: ['scan'] }),
      ]);
      break;
  }
}
