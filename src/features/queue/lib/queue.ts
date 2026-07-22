// features/queue/lib/queue.ts
// Unified queue position logic — deep module implementing ADR-0009 + scan actions.
// Single source of truth for: assign, reorder, next, count, promote scheduled.

import { getDb } from '@/adapters/idb/base';
import {
  getPrescriptionById,
  countByStatus as dbCountByStatus,
} from '@/entities/prescription/model/store';
import { todayISO } from '@/shared/lib/excel-date';
import type { Prescription, PrescriptionStatus } from '@/entities/prescription/model/types';

export type QueueFilter =
  | { type: 'default' }
  | { type: 'urgent' }
  | { type: 'pending' }
  | { type: 'skipped' }
  | { type: 'vip' }
  | { type: 'scheduled' }
  | { type: 'dispensed' }
  | { type: 'byId'; id: number };

function urgentSortKey(rx: Prescription): string {
  return rx.scheduled_date ?? rx.created_at ?? '';
}

export async function getTopInQueue(filter: QueueFilter, limit: number): Promise<Prescription[]> {
  const db = await getDb();
  let rows: Prescription[] = [];

  if (filter.type === 'byId') {
    const rx = await getPrescriptionById(filter.id);
    return rx ? [rx] : [];
  }

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

  // Common sort: ascending by queue_position
  rows.sort((a: Prescription, b: Prescription) => (a.queue_position ?? 0) - (b.queue_position ?? 0));

  // Override sorts for special filters
  if (filter.type === 'vip') {
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
  }

  return rows.slice(0, limit);
}

export async function countByStatus(status: PrescriptionStatus): Promise<number> {
  return dbCountByStatus(status);
}

export async function countForFilter(filter: QueueFilter): Promise<number> {
  const db = await getDb();

  switch (filter.type) {
    case 'default': {
      const pending = await dbCountByStatus('pending');
      const skipped = await dbCountByStatus('skipped');
      return pending + skipped;
    }
    case 'urgent': {
      const today = todayISO();
      const rows1 = await db.getAllFromIndex('prescriptions', 'by_status', 'due_today');
      const rows2 = await db.getAllFromIndex('prescriptions', 'by_status', 'overdue');
      return [...rows1, ...rows2].filter((r: Prescription) => !r.actioned_at || !r.actioned_at.startsWith(today)).length;
    }
    case 'pending':
      return dbCountByStatus('pending');
    case 'skipped':
      return dbCountByStatus('skipped');
    case 'vip': {
      const statuses: PrescriptionStatus[] = ['pending', 'skipped', 'due_today', 'overdue'];
      let count = 0;
      for (const s of statuses) {
        const rows = await db.getAllFromIndex('prescriptions', 'by_status', s);
        count += rows.filter((r: Prescription) => r.is_vip).length;
      }
      return count;
    }
    case 'scheduled':
      return dbCountByStatus('scheduled');
    case 'dispensed':
      return dbCountByStatus('dispensed');
    case 'byId':
      return 1;
  }
}
