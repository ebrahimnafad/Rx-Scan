// features/sync/lib/upsert.ts
// Surgical IDB upsert — implements ADR-0002 + ADR-0008.
//
// Rules:
//   pending / skipped     → full replace (fresh sheet data wins)
//   acted-on prescriptions→ preserve action state;
//                           UPDATE is_vip, drug_name_sheet2,
//                                   loyalty_name, loyalty_phone ONLY
//   New prescriptions      → INSERT as 'pending'
//
// Queue position assignment is delegated to features/queue/lib/queue.ts (ADR-0009).
// Optimized: batches all dedup-key lookups in single transaction.

import type { MergedPrescription } from '@/entities/prescription/model/types';
import {
  getDb,
} from '@/app/db';
import { nowISO } from '@/shared/lib/excel-date';
import type { Prescription } from '@/entities/prescription/model/types';
import { ACTED_STATUSES as ACTED_STATUSES_ARR } from '@/entities/prescription/lib/status';

// Use a Set for O(1) lookup, derived from the canonical array in status.ts (C3)
const ACTED_STATUSES = new Set(ACTED_STATUSES_ARR);

export async function surgicalUpsert(prescriptions: MergedPrescription[]): Promise<void> {
  const db = await getDb();

  // 1. Build dedup keys and fetch ALL existing in one transaction
  const dedupKeys = prescriptions.map(m => [m.reference_number, m.patient_national_id] as const);
  const existingMap = new Map<string, any>();

  const tx = db.transaction('prescriptions', 'readonly');
  await Promise.all(dedupKeys.map(([ref, natId]) =>
    tx.store.index('by_dedup_key').get([ref, natId]).then((rx: Prescription | undefined) => {
      if (rx) existingMap.set(`${ref}||${natId}`, rx);
    })
  ));
  await tx.done;

  // 2. Prepare all writes, then execute in single readwrite transaction
  const writeTx = db.transaction('prescriptions', 'readwrite');
  const now = nowISO();

  for (const merged of prescriptions) {
    const key = `${merged.reference_number}||${merged.patient_national_id}`;
    const existing = existingMap.get(key);

    if (!existing) {
      // New — insert as pending
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
      // pending or skipped → full replace (preserve id, status, queue_position, notes, etc.)
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
      // acted-on → enrich only (ADR-0008)
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

  await writeTx.done;
}
