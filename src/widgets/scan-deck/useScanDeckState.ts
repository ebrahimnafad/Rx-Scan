// widgets/scan-deck/useScanDeckState.ts
// Data + action layer for the scan deck.
// Owns query fetching, filter mapping, action orchestration, and ghost data.
// The component keeps UI state (card face, schedule, animation) + rendering.

import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { countForFilter, countByStatus, getTopInQueue, type QueueFilter } from '@/features/queue/lib/queue';
import { useScanActions } from '@/features/scan-actions/lib/useScanActions';
import { isSortKey } from '@/entities/prescription/lib/view';
import type { Prescription } from '@/entities/prescription/model/types';
import { queryKeys } from '@/shared/api/queryKeys';

function parseQueueFilter(
  raw: string | null,
  rxId: string | null,
  sort: string | null,
  dir: string | null,
  q: string | null
): QueueFilter {
  if (rxId) {
    const id = Number(rxId);
    if (!isNaN(id)) return { type: 'byId', id };
  }
  const filter: QueueFilter =
    raw === 'urgent'    ? { type: 'urgent' } :
    raw === 'pending'   ? { type: 'pending' } :
    raw === 'skipped'   ? { type: 'skipped' } :
    raw === 'vip'       ? { type: 'vip' } :
    raw === 'scheduled' ? { type: 'scheduled' } :
    raw === 'dispensed' ? { type: 'dispensed' } :
    { type: 'default' };

  if (isSortKey(sort)) filter.sort = sort;
  if (dir === 'asc' || dir === 'desc') filter.sortDir = dir;
  if (q?.trim()) filter.search = q.trim();

  return filter;
}

export function useScanDeckState() {
  const [searchParams] = useSearchParams();
  const filter  = searchParams.get('filter');
  const rxParam = searchParams.get('rx');
  const sort    = searchParams.get('sort');
  const dir     = searchParams.get('dir');
  const q       = searchParams.get('q');

  const queueFilter = parseQueueFilter(filter, rxParam, sort, dir, q);

  // Single query for top card + 2 ghost cards — atomically consistent on invalidation (B2)
  const { data: topCards = [], isPending } = useQuery({
    queryKey: queryKeys.queue.scan(filter, rxParam, sort, dir, q),
    queryFn:  () => getTopInQueue(queueFilter, 3),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: queryKeys.queue.countFilter(filter, rxParam, sort, dir, q),
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
