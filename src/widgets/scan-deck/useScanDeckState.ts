// widgets/scan-deck/useScanDeckState.ts
// Data + action layer for the scan deck.
// Owns query fetching, filter mapping, action orchestration, and ghost data.
// The component keeps UI state (card face, schedule, animation) + rendering.

import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { countForFilter, countByStatus, getTopInQueue, type QueueFilter } from '@/features/queue/lib/queue';
import { useScanActions } from '@/features/scan-actions/lib/useScanActions';
import type { Prescription } from '@/entities/prescription/model/types';
import { queryKeys } from '@/shared/api/queryKeys';

function parseQueueFilter(raw: string | null, rxId: string | null): QueueFilter {
  if (rxId) {
    const id = Number(rxId);
    if (!isNaN(id)) return { type: 'byId', id };
  }
  if (raw === 'urgent')    return { type: 'urgent' };
  if (raw === 'pending')   return { type: 'pending' };
  if (raw === 'skipped')   return { type: 'skipped' };
  if (raw === 'vip')       return { type: 'vip' };
  if (raw === 'scheduled') return { type: 'scheduled' };
  if (raw === 'dispensed') return { type: 'dispensed' };
  return { type: 'default' };
}

export function useScanDeckState() {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter');
  const rxParam = searchParams.get('rx');

  const queueFilter = parseQueueFilter(filter, rxParam);

  // Single query for top card + 2 ghost cards — atomically consistent on invalidation (B2)
  const { data: topCards = [], isPending } = useQuery({
    queryKey: queryKeys.queue.scan(filter, rxParam),
    queryFn:  () => getTopInQueue(queueFilter, 3),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: queryKeys.queue.countFilter(filter, rxParam),
    queryFn:  () => countForFilter(queueFilter),
    staleTime: 30_000,
  });
  const { data: skippedCount = 0 } = useQuery({
    queryKey: queryKeys.queue.countSkipped(),
    queryFn:  () => countByStatus('skipped'),
    staleTime: 30_000,
  });

  const actions = useScanActions();

  return {
    rx:          topCards[0] as Prescription | undefined,
    nextRx:      topCards[1] as Prescription | undefined,
    nextNextRx:  topCards[2] as Prescription | undefined,
    pendingCount,
    skippedCount,
    filter,
    isPending,
    isSingleCard: !!rxParam,
    ...actions,
  };
}
