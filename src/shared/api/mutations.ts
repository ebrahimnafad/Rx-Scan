// shared/api/mutations.ts
// Centralized query invalidation after mutations.
// Replaces sweep invalidation with targeted key-based invalidation.

import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export type MutationType =
  | 'scanAction'
  | 'noteChange'
  | 'notificationReset'
  | 'sync'
  | 'importJson'
  | 'scheduleUpdate';

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
        qc.invalidateQueries({ queryKey: queryKeys.prescriptions.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.queue.scan(null, null) }),
        qc.invalidateQueries({ queryKey: queryKeys.queue.countAll() }),
      ]);
      break;

    case 'noteChange':
      await qc.invalidateQueries({ queryKey: queryKeys.prescriptions.all() });
      break;

    case 'notificationReset':
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.prescriptions.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.queue.countAll() }),
      ]);
      break;

    case 'sync':
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.prescriptions.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.queue.scan(null, null) }),
        qc.invalidateQueries({ queryKey: queryKeys.queue.countAll() }),
        qc.invalidateQueries({ queryKey: queryKeys.settings.all() }),
      ]);
      break;

    case 'importJson':
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.prescriptions.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.settings.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.queue.countAll() }),
        qc.invalidateQueries({ queryKey: queryKeys.queue.scan(null, null) }),
      ]);
      break;

    case 'scheduleUpdate':
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.prescriptions.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.queue.countAll() }),
        qc.invalidateQueries({ queryKey: queryKeys.queue.scan(null, null) }),
      ]);
      break;
  }
}
