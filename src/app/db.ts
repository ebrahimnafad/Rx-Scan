// app/db.ts — RxScan database adapter (thin wrapper over adapters/idb)
// This is the PUBLIC interface used by features. Swaps to memory adapter in tests.

import {
  getDb,
  get as baseGet,
  getAll as baseGetAll,
  getFromIndex as baseGetFromIndex,
  getAllFromIndex as baseGetAllFromIndex,
  put as basePut,
  countFromIndex as baseCountFromIndex,
  clear as baseClear,
} from '@/adapters/idb/base';
import type { Prescription, Settings, PrescriptionStatus } from '@/entities/prescription/model/types';

// ── Settings helpers ────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const all = await db.getAll('settings');
  const obj: Record<string, string> = {};
  for (const row of all) obj[row.key] = row.value;
  return {
    sheet1_url:               obj['sheet1_url'],
    sheet2_url:               obj['sheet2_url'],
    sheet1_name:              obj['sheet1_name'],
    sheet2_name:              obj['sheet2_name'],
    branch_number:            obj['branch_number'],
    branch_address:           obj['branch_address'],
    google_maps_link:         obj['google_maps_link'],
    default_sort:             obj['default_sort'] as Settings['default_sort'],
    last_sync_at:             obj['last_sync_at'],
    last_sync_count_sheet1:   obj['last_sync_count_sheet1']
                                ? Number(obj['last_sync_count_sheet1']) : undefined,
    last_sync_count_sheet2:   obj['last_sync_count_sheet2']
                                ? Number(obj['last_sync_count_sheet2']) : undefined,
    notified_light_duration_days: obj['notified_light_duration_days']
                                ? Number(obj['notified_light_duration_days']) : undefined,
    wa_message_template:        obj['wa_message_template'],
  };
}

export async function saveSetting(key: string, value: string | number): Promise<void> {
  const db = await getDb();
  await db.put('settings', { key, value: String(value) });
}

export async function saveSettings(patch: Partial<Record<string, string | number>>): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('settings', 'readwrite');
  await Promise.all(
    Object.entries(patch).map(([k, v]) => tx.store.put({ key: k, value: String(v) }))
  );
  await tx.done;
}

// ── Prescription helpers (low-level CRUD) ──────────────────────

export async function getAllPrescriptions(): Promise<Prescription[]> {
  return baseGetAll<Prescription>('prescriptions');
}

export async function getPrescriptionById(id: number): Promise<Prescription | undefined> {
  return baseGet<Prescription>('prescriptions', id);
}

export async function getPrescriptionByDedupKey(
  ref: string,
  natId: string
): Promise<Prescription | undefined> {
  return baseGetFromIndex<Prescription>('prescriptions', 'by_dedup_key', [ref, natId]);
}

export async function getPrescriptionsByStatus(
  status: PrescriptionStatus | PrescriptionStatus[]
): Promise<Prescription[]> {
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

export async function upsertPrescription(rx: Prescription): Promise<number> {
  return basePut('prescriptions', rx) as Promise<number>;
}

export async function updatePrescription(
  id: number,
  patch: Partial<Prescription>
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('prescriptions', 'readwrite');
  const existing = await tx.store.get(id);
  if (!existing) { await tx.done; return; }
  await tx.store.put({ ...existing, ...patch, id, updated_at: new Date().toISOString() });
  await tx.done;
}

export async function countByStatus(status: PrescriptionStatus): Promise<number> {
  return baseCountFromIndex('prescriptions', 'by_status', status);
}

export async function countAllStatuses(): Promise<Record<PrescriptionStatus, number>> {
  const statuses: PrescriptionStatus[] = [
    'pending', 'due_today', 'overdue', 'skipped', 'dispensed', 'scheduled',
  ];
  const result = {} as Record<PrescriptionStatus, number>;
  for (const s of statuses) {
    result[s] = await baseCountFromIndex('prescriptions', 'by_status', s);
  }
  return result;
}

export async function clearAllPrescriptions(): Promise<void> {
  await baseClear('prescriptions');
}

export async function eraseAllData(): Promise<void> {
  await Promise.all([baseClear('prescriptions'), baseClear('settings')]);
}

// Re-export schema types for consumers
export { type RxScanDBSchema } from '@/adapters/idb/schema';
export { getDb } from '@/adapters/idb/base';