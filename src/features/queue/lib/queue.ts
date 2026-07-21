// features/queue/lib/queue.ts
// Unified queue position logic — deep module implementing ADR-0009 + scan actions.
// Single source of truth for: assign, reorder, next, count, promote scheduled.

import {
  getDb,
  getPrescriptionById,
  getPrescriptionsByStatus,
  countByStatus as dbCountByStatus,
} from '@/app/db';
import { todayISO, nowISO } from '@/shared/lib/excel-date';
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
  return rx.trx_date ?? rx.created_at ?? '';
}

export async function next(filter: QueueFilter): Promise<Prescription | undefined> {
  const db = await getDb();

  if (filter.type === 'byId') {
    return getPrescriptionById(filter.id);
  }

  if (filter.type === 'default') {
    const pendingRows = await db.getAllFromIndex('prescriptions', 'by_status', 'pending');
    const validPending = pendingRows.filter((r: Prescription) => r.queue_position !== null);
    if (validPending.length) {
      validPending.sort((a: Prescription, b: Prescription) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
      return validPending[0];
    }
    const skippedRows = await db.getAllFromIndex('prescriptions', 'by_status', 'skipped');
    const validSkipped = skippedRows.filter((r: Prescription) => r.queue_position !== null);
    if (validSkipped.length) {
      validSkipped.sort((a: Prescription, b: Prescription) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
      return validSkipped[0];
    }
    return undefined;
  }

  if (filter.type === 'pending') {
    const rows = await db.getAllFromIndex('prescriptions', 'by_status', 'pending');
    const valid = rows.filter((r: Prescription) => r.queue_position !== null);
    valid.sort((a: Prescription, b: Prescription) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
    return valid[0];
  }

  if (filter.type === 'skipped') {
    const rows = await db.getAllFromIndex('prescriptions', 'by_status', 'skipped');
    const valid = rows.filter((r: Prescription) => r.queue_position !== null);
    valid.sort((a: Prescription, b: Prescription) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
    return valid[0];
  }

  if (filter.type === 'vip') {
    const statuses: PrescriptionStatus[] = ['pending', 'skipped', 'due_today', 'overdue'];
    const all: Prescription[] = [];
    for (const s of statuses) {
      const rows = await db.getAllFromIndex('prescriptions', 'by_status', s);
      all.push(...rows.filter((r: Prescription) => r.is_vip));
    }
    all.sort((a: Prescription, b: Prescription) => {
      const aUrgent = a.status === 'due_today' || a.status === 'overdue';
      const bUrgent = b.status === 'due_today' || b.status === 'overdue';
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity);
    });
    return all[0];
  }

  if (filter.type === 'urgent') {
    const statuses: PrescriptionStatus[] = ['due_today', 'overdue'];
    const all: Prescription[] = [];
    for (const s of statuses) {
      const rows = await db.getAllFromIndex('prescriptions', 'by_status', s);
      all.push(...rows);
    }
    all.sort((a, b) => urgentSortKey(a).localeCompare(urgentSortKey(b)));
    return all[0];
  }

  if (filter.type === 'scheduled') {
    const rows = await db.getAllFromIndex('prescriptions', 'by_status', 'scheduled');
    rows.sort((a: Prescription, b: Prescription) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''));
    return rows[0];
  }

  if (filter.type === 'dispensed') {
    const rows = await db.getAllFromIndex('prescriptions', 'by_status', 'dispensed');
    rows.sort((a: Prescription, b: Prescription) => (b.dispensed_at ?? '').localeCompare(a.dispensed_at ?? ''));
    return rows[0];
  }

  return undefined;
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
      const dueToday = await dbCountByStatus('due_today');
      const overdue = await dbCountByStatus('overdue');
      return dueToday + overdue;
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

export async function assign(): Promise<void> {
  const db = await getDb();
  const pending = await getPrescriptionsByStatus('pending');

  // Sort pending: VIP first (desc), then trx_date desc
  pending.sort((a: Prescription, b: Prescription) => {
    if (a.is_vip !== b.is_vip) return a.is_vip ? -1 : 1;
    const da = a.trx_date ?? '0000-00-00';
    const db2 = b.trx_date ?? '0000-00-00';
    return da < db2 ? 1 : da > db2 ? -1 : 0;
  });

  const skipped = await getPrescriptionsByStatus('skipped');
  skipped.sort((a: Prescription, b: Prescription) => {
    return (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity);
  });

  const tx = db.transaction('prescriptions', 'readwrite');
  let pos = 0;
  for (const rx of [...pending, ...skipped]) {
    if (!rx.id) continue;
    const existing = await tx.store.get(rx.id);
    if (existing) {
      await tx.store.put({ ...existing, queue_position: pos++, updated_at: nowISO() });
    }
  }
  await tx.done;
}

export async function promoteScheduled(): Promise<boolean> {
  const db = await getDb();
  const scheduled = await getPrescriptionsByStatus('scheduled');
  const today = todayISO();

  const toOverdue: number[] = [];
  const toDueToday: number[] = [];

  for (const rx of scheduled) {
    if (!rx.scheduled_date || !rx.id) continue;
    if (rx.scheduled_date < today) toOverdue.push(rx.id);
    else if (rx.scheduled_date === today) toDueToday.push(rx.id);
  }

  if (!toOverdue.length && !toDueToday.length) return false;

  const now = nowISO();
  const tx = db.transaction('prescriptions', 'readwrite');

  for (const id of toOverdue) {
    const existing = await tx.store.get(id);
    if (existing) await tx.store.put({ ...existing, status: 'overdue', queue_position: null, updated_at: now });
  }
  for (const id of toDueToday) {
    const existing = await tx.store.get(id);
    if (existing) await tx.store.put({ ...existing, status: 'due_today', queue_position: null, updated_at: now });
  }

  await tx.done;
  return true;
}