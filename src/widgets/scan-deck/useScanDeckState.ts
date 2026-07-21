// widgets/scan-deck/useScanDeckState.ts
// Data + action layer for the scan deck.
// Owns query fetching, filter mapping, action orchestration, and ghost data.
// The component keeps UI state (card face, schedule, animation) + rendering.

import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { countForFilter, countByStatus, next, type QueueFilter } from '@/features/queue/lib/queue';
import { useScanActions } from '@/features/scan-actions/lib/useScanActions';
import type { Prescription } from '@/entities/prescription/model/types';
import { getDb } from '@/app/db';

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

async function nextN(filter: QueueFilter, count: number): Promise<Prescription[]> {
  if (filter.type === 'byId') {
    const rx = await next(filter);
    return rx ? [rx] : [];
  }
  const db = await getDb();
  let rows: Prescription[] = [];

  if (filter.type === 'default') {
    const pending = (await db.getAllFromIndex('prescriptions', 'by_status', 'pending'))
      .filter((r: Prescription) => r.queue_position !== null);
    const skipped = (await db.getAllFromIndex('prescriptions', 'by_status', 'skipped'))
      .filter((r: Prescription) => r.queue_position !== null);
    rows = [...pending, ...skipped];
  } else if (filter.type === 'pending') {
    rows = (await db.getAllFromIndex('prescriptions', 'by_status', 'pending'))
      .filter((r: Prescription) => r.queue_position !== null);
  } else if (filter.type === 'skipped') {
    rows = (await db.getAllFromIndex('prescriptions', 'by_status', 'skipped'))
      .filter((r: Prescription) => r.queue_position !== null);
  } else if (filter.type === 'vip') {
    const statuses: Prescription[] = [];
    for (const s of ['pending', 'skipped', 'due_today', 'overdue'] as const) {
      const batch = await db.getAllFromIndex('prescriptions', 'by_status', s);
      statuses.push(...batch.filter((r: Prescription) => r.is_vip));
    }
    rows = statuses;
  } else if (filter.type === 'urgent') {
    for (const s of ['due_today', 'overdue'] as const) {
      const batch = await db.getAllFromIndex('prescriptions', 'by_status', s);
      rows.push(...batch);
    }
  } else if (filter.type === 'scheduled') {
    rows = await db.getAllFromIndex('prescriptions', 'by_status', 'scheduled');
  } else if (filter.type === 'dispensed') {
    rows = await db.getAllFromIndex('prescriptions', 'by_status', 'dispensed');
  }

  rows.sort((a: Prescription, b: Prescription) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
  if (filter.type === 'vip') {
    rows.sort((a: Prescription, b: Prescription) => {
      const aUrgent = a.status === 'due_today' || a.status === 'overdue';
      const bUrgent = b.status === 'due_today' || b.status === 'overdue';
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity);
    });
  }
  if (filter.type === 'scheduled') {
    rows.sort((a: Prescription, b: Prescription) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''));
  }
  if (filter.type === 'dispensed') {
    rows.sort((a: Prescription, b: Prescription) => (b.dispensed_at ?? '').localeCompare(a.dispensed_at ?? ''));
  }

  return rows.slice(0, count);
}

export function useScanDeckState() {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter');
  const rxParam = searchParams.get('rx');

  const queueFilter = parseQueueFilter(filter, rxParam);

  // Single query for top card + 2 ghost cards — atomically consistent on invalidation (B2)
  const { data: topCards = [], isPending } = useQuery({
    queryKey: ['scan', filter, rxParam],
    queryFn:  () => nextN(queueFilter, 3),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['count', 'filter', filter, rxParam],
    queryFn:  () => countForFilter(queueFilter),
    staleTime: 30_000,
  });
  const { data: skippedCount = 0 } = useQuery({
    queryKey: ['count', 'skipped'],
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
