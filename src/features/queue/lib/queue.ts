// features/queue/lib/queue.ts
// Unified queue position logic — deep module implementing ADR-0009 + scan actions.
// Single source of truth for: assign, reorder, next, count, promote scheduled.

import { getDb } from '@/adapters/idb/base';
import {
  getPrescriptionById,
  countByStatus as dbCountByStatus,
} from '@/entities/prescription/model/store';
import { todayISO } from '@/shared/lib/excel-date';
import { applySort, matchesQuery } from '@/entities/prescription/lib/view';
import type { Prescription, PrescriptionStatus, SortKey } from '@/entities/prescription/model/types';

export interface QueueFilter {
  type: 'default' | 'urgent' | 'pending' | 'skipped' | 'vip' | 'scheduled' | 'dispensed' | 'byId';
  id?: number;
  sort?: SortKey;
  sortDir?: 'asc' | 'desc';
  search?: string;
}

function urgentSortKey(rx: Prescription): string {
  return rx.scheduled_date ?? rx.created_at ?? '';
}

/**
 * Load the full (unlimited) deck set for a filter — DB rows + search + sort.
 * Search/sort mirror the prescriptions list (shared applySort/matchesQuery) so
 * the deck always presents exactly what the list showed.
 */
async function loadRows(filter: QueueFilter): Promise<Prescription[]> {
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
    const statuses: PrescriptionStatus[] = ['pending', 'skipped', 'due_today', 'overdue'];
    for (const s of statuses) {
      const batch = await db.getAllFromIndex('prescriptions', 'by_status', s);
      rows.push(...batch.filter((r: Prescription) => r.is_vip));
    }
  } else if (filter.type === 'urgent') {
    const statuses: PrescriptionStatus[] = ['due_today', 'overdue'];
    const today = todayISO();
    for (const s of statuses) {
      const batch = await db.getAllFromIndex('prescriptions', 'by_status', s);
      rows.push(...batch.filter((r: Prescription) => !r.actioned_at || !r.actioned_at.startsWith(today)));
    }
  } else if (filter.type === 'scheduled') {
    rows = await db.getAllFromIndex('prescriptions', 'by_status', 'scheduled');
  } else if (filter.type === 'dispensed') {
    rows = await db.getAllFromIndex('prescriptions', 'by_status', 'dispensed');
  }

  // Search filter (mirrors the list's search box)
  const search = filter.search?.trim() ?? '';
  if (search) rows = rows.filter(r => matchesQuery(r, search));

  // Explicit sort from the list wins; otherwise keep the per-filter default order.
  if (filter.sort) {
    rows = applySort(rows, filter.sort, filter.sortDir ?? 'asc');
  } else if (filter.type === 'vip') {
    rows.sort((a: Prescription, b: Prescription) => {
      const aUrgent = a.status === 'due_today' || a.status === 'overdue';
      const bUrgent = b.status === 'due_today' || b.status === 'overdue';
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity);
    });
  } else if (filter.type === 'urgent') {
    rows.sort((a: Prescription, b: Prescription) => urgentSortKey(a).localeCompare(urgentSortKey(b)));
  } else if (filter.type === 'scheduled') {
    rows.sort((a: Prescription, b: Prescription) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''));
  } else if (filter.type === 'dispensed') {
    rows.sort((a: Prescription, b: Prescription) => (b.dispensed_at ?? '').localeCompare(a.dispensed_at ?? ''));
  } else {
    // default / pending / skipped: ascending queue_position
    rows.sort((a: Prescription, b: Prescription) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
  }

  return rows;
}

export async function getTopInQueue(filter: QueueFilter, limit: number): Promise<Prescription[]> {
  if (filter.type === 'byId') {
    if (filter.id == null) return [];
    const rx = await getPrescriptionById(filter.id);
    return rx ? [rx] : [];
  }

  const rows = await loadRows(filter);
  return rows.slice(0, limit);
}

export async function countByStatus(status: PrescriptionStatus): Promise<number> {
  return dbCountByStatus(status);
}

export async function countForFilter(filter: QueueFilter): Promise<number> {
  if (filter.type === 'byId') return 1;
  return (await loadRows(filter)).length;
}
