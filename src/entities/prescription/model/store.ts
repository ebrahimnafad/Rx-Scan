import {
  getDb,
  get as baseGet,
  getAll as baseGetAll,
  getFromIndex as baseGetFromIndex,
  getAllFromIndex as baseGetAllFromIndex,
  countFromIndex as baseCountFromIndex,
  clear as baseClear,
} from '@/adapters/idb/base';
import type { IDBPTransaction } from 'idb';
import type { RxScanDBSchema } from '@/adapters/idb/schema';
import type { Prescription, PrescriptionStatus, MergedPrescription } from './types';
import { ACTED_STATUSES as ACTED_STATUSES_ARR } from '../lib/status';
import { nowISO, todayISO } from '@/shared/lib/excel-date';

const ACTED_STATUSES = new Set(ACTED_STATUSES_ARR);

export async function rebalanceQueueTx(tx: IDBPTransaction<RxScanDBSchema, any, 'readwrite'>, now: string) {
  const allPending = await tx.objectStore('prescriptions').index('by_status').getAll('pending');
  const allSkipped = await tx.objectStore('prescriptions').index('by_status').getAll('skipped');

  allPending.sort((a, b) => {
    if (a.is_vip !== b.is_vip) return a.is_vip ? -1 : 1;
    const da = a.scheduled_date ?? '0000-00-00';
    const db = b.scheduled_date ?? '0000-00-00';
    return da < db ? 1 : da > db ? -1 : 0;
  });

  allSkipped.sort((a, b) => (a.queue_position ?? Infinity) - (b.queue_position ?? Infinity));

  let pos = 0;
  for (const rx of [...allPending, ...allSkipped]) {
    if (!rx.id) continue;
    if (rx.queue_position !== pos) {
      await tx.objectStore('prescriptions').put({ ...rx, queue_position: pos, updated_at: now });
    }
    pos++;
  }
}

export async function getAllPrescriptions(): Promise<Prescription[]> {
  return baseGetAll<Prescription>('prescriptions');
}

export async function getPrescriptionById(id: number): Promise<Prescription | undefined> {
  return baseGet<Prescription>('prescriptions', id);
}

export async function getPrescriptionByDedupKey(ref: string, natId: string): Promise<Prescription | undefined> {
  return baseGetFromIndex<Prescription>('prescriptions', 'by_dedup_key', [ref, natId]);
}

export async function getPrescriptionsByStatus(status: PrescriptionStatus | PrescriptionStatus[]): Promise<Prescription[]> {
  const statuses = Array.isArray(status) ? status : [status];
  const all: Prescription[] = [];
  for (const s of statuses) {
    const rows = await baseGetAllFromIndex<Prescription>('prescriptions', 'by_status', s);
    all.push(...rows);
  }
  return all;
}

export async function getPrescriptionsByPatient(natId: string): Promise<Prescription[]> {
  return baseGetAllFromIndex<Prescription>('prescriptions', 'by_patient_national_id', natId);
}

export async function countByStatus(status: PrescriptionStatus): Promise<number> {
  return baseCountFromIndex('prescriptions', 'by_status', status);
}

export async function countAllStatuses(): Promise<Record<PrescriptionStatus, number>> {
  const statuses: PrescriptionStatus[] = ['pending', 'due_today', 'overdue', 'skipped', 'dispensed', 'scheduled'];
  const result = {} as Record<PrescriptionStatus, number>;
  for (const s of statuses) {
    result[s] = await baseCountFromIndex('prescriptions', 'by_status', s);
  }
  return result;
}

export async function clearAllPrescriptions(): Promise<void> {
  await baseClear('prescriptions');
}

export async function restorePrescriptionsIntoTx(
  tx: IDBPTransaction<RxScanDBSchema, any, 'readwrite'>,
  prescriptions: Prescription[],
  now: string
): Promise<void> {
  await tx.objectStore('prescriptions').clear();
  for (const rx of prescriptions) {
    await tx.objectStore('prescriptions').put({ ...rx, updated_at: now });
  }
  await rebalanceQueueTx(tx, now);
}

export async function upsertPrescriptionsBatch(prescriptions: MergedPrescription[]): Promise<void> {
  const db = await getDb();
  const dedupKeys = prescriptions.map(m => [m.reference_number, m.patient_national_id] as const);
  const existingMap = new Map<string, any>();

  const readTx = db.transaction('prescriptions', 'readonly');
  await Promise.all(dedupKeys.map(([ref, natId]) =>
    readTx.store.index('by_dedup_key').get([ref, natId]).then((rx) => {
      if (rx) existingMap.set(`${ref}||${natId}`, rx);
    })
  ));
  await readTx.done;

  const writeTx = db.transaction('prescriptions', 'readwrite');
  const now = nowISO();

  for (const merged of prescriptions) {
    const key = `${merged.reference_number}||${merged.patient_national_id}`;
    const existing = existingMap.get(key);

    if (!existing) {
      await writeTx.store.put({
        reference_number:    merged.reference_number,
        patient_national_id: merged.patient_national_id,
        loyalty_name:        merged.loyalty_name,
        loyalty_phone:       merged.loyalty_phone,
        drug_name_sheet1:    merged.drug_name_sheet1,
        drug_name_sheet2:    merged.drug_name_sheet2,
        gross_value:         merged.gross_value,
        trx_date:            merged.trx_date,
        is_vip:              merged.is_vip,
        status:              'pending',
        scheduled_date:      null,
        queue_position:      null,
        notes:               null,
        dispensed_at:        null,
        actioned_at:         null,
        notified_via:        null,
        notified_at:         null,
        created_at:          now,
        updated_at:          now,
      });
    } else if (!ACTED_STATUSES.has(existing.status)) {
      await writeTx.store.put({
        ...merged,
        id:             existing.id,
        status:         existing.status,
        queue_position: existing.queue_position,
        notes:          existing.notes,
        scheduled_date: existing.scheduled_date,
        dispensed_at:   existing.dispensed_at,
        actioned_at:    existing.actioned_at,
        notified_via:   existing.notified_via,
        notified_at:    existing.notified_at,
        created_at:     existing.created_at,
        updated_at:     now,
      });
    } else {
      if (!existing.id) continue;
      await writeTx.store.put({
        ...existing,
        is_vip:           merged.is_vip,
        drug_name_sheet2: merged.drug_name_sheet2 ?? existing.drug_name_sheet2,
        loyalty_name:     existing.loyalty_name ?? merged.loyalty_name,
        loyalty_phone:    existing.loyalty_phone ?? merged.loyalty_phone,
        updated_at:       now,
      });
    }
  }

  await rebalanceQueueTx(writeTx, now);
  await writeTx.done;
}

export async function updatePrescription(id: number, patch: Partial<Prescription>): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('prescriptions', 'readwrite');
  const now = nowISO();

  const existing = await tx.store.get(id);
  if (!existing) {
    await tx.done;
    return;
  }

  await tx.store.put({ ...existing, ...patch, id, updated_at: now });

  if (patch.status !== undefined || patch.scheduled_date !== undefined || patch.queue_position === null || patch.is_vip !== undefined) {
    await rebalanceQueueTx(tx, now);
  }

  await tx.done;
}

export async function revealAllSkippedPrescriptions(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('prescriptions', 'readwrite');
  const now = nowISO();

  const skipped = await tx.store.index('by_status').getAll('skipped');
  for (const rx of skipped) {
    await tx.store.put({ ...rx, status: 'pending', updated_at: now });
  }

  await rebalanceQueueTx(tx, now);
  await tx.done;
}

export async function promoteScheduledPrescriptions(): Promise<boolean> {
  const db = await getDb();
  const tx = db.transaction('prescriptions', 'readwrite');
  const today = todayISO();
  const now = nowISO();

  const scheduled = await tx.store.index('by_status').getAll('scheduled');
  let changed = false;

  for (const rx of scheduled) {
    if (!rx.scheduled_date) continue;
    if (rx.scheduled_date < today) {
      await tx.store.put({ ...rx, status: 'overdue', queue_position: null, updated_at: now });
      changed = true;
    } else if (rx.scheduled_date === today) {
      await tx.store.put({ ...rx, status: 'due_today', queue_position: null, updated_at: now });
      changed = true;
    }
  }

  if (changed) {
    await rebalanceQueueTx(tx, now);
  }

  await tx.done;
  return changed;
}
