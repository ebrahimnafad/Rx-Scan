// entities/prescription/lib/dedup.ts
// Full outer merge of Sheet1 + Sheet2 rows, then patient enrichment pass.
// Implements ADR-0007 (full outer merge) and ADR-0006 (patient enrichment).

import type {
  Sheet1Row,
  Sheet2Row,
  MergedPrescription,
} from '../model/types';

/** Composite dedup key (ADR-0001) */
function dedupKey(ref: string, natId: string): string {
  return `${ref}||${natId}`;
}

/**
 * Full outer merge: both sheets contribute prescriptions.
 * Matching rows (same dedup key) → one card with is_vip = true and all fields merged.
 * Sheet 1 only → is_vip = false, sheet 2 fields null.
 * Sheet 2 only → is_vip = true, sheet 1 fields null.
 */
export function fullOuterMerge(
  sheet1: Sheet1Row[],
  sheet2: Sheet2Row[]
): MergedPrescription[] {
  const merged = new Map<string, MergedPrescription>();

  // Seed from Sheet 1
  for (const row of sheet1) {
    const key = dedupKey(row.reference_number, row.patient_national_id);
    merged.set(key, {
      reference_number:    row.reference_number,
      patient_national_id: row.patient_national_id,
      loyalty_name:        row.loyalty_name,
      loyalty_phone:       row.loyalty_phone,
      drug_name_sheet1:    row.drug_name_sheet1,
      drug_name_sheet2:    null,
      gross_value:         row.gross_value,
      trx_date:            row.trx_date,
      is_vip:              false,
    });
  }

  // Merge Sheet 2 — match or insert
  for (const row of sheet2) {
    const key = dedupKey(row.reference_number, row.patient_national_id);
    const existing = merged.get(key);

    if (existing) {
      // Match: enrich sheet 2 fields, mark VIP
      merged.set(key, {
        ...existing,
        drug_name_sheet2: row.drug_name_sheet2,
        loyalty_phone:    existing.loyalty_phone ?? row.loyalty_phone,
        is_vip:           true,
      });
    } else {
      // Sheet 2 only
      merged.set(key, {
        reference_number:    row.reference_number,
        patient_national_id: row.patient_national_id,
        loyalty_name:        null,
        loyalty_phone:       row.loyalty_phone,
        drug_name_sheet1:    null,
        drug_name_sheet2:    row.drug_name_sheet2,
        gross_value:         0,
        trx_date:            null,
        is_vip:              true,
      });
    }
  }

  return [...merged.values()];
}

/**
 * Patient enrichment pass (ADR-0006).
 * After merging, propagate non-null loyalty_name and loyalty_phone
 * to ALL prescriptions sharing the same patient_national_id.
 * The first non-null value encountered becomes the canonical value for that patient.
 */
export function patientEnrichment(prescriptions: MergedPrescription[]): MergedPrescription[] {
  // Build patient-level name/phone index (first non-null wins)
  const names  = new Map<string, string>();
  const phones = new Map<string, string>();

  for (const rx of prescriptions) {
    if (rx.loyalty_name  && !names.has(rx.patient_national_id))
      names.set(rx.patient_national_id, rx.loyalty_name);
    if (rx.loyalty_phone && !phones.has(rx.patient_national_id))
      phones.set(rx.patient_national_id, rx.loyalty_phone);
  }

  // Propagate to ALL prescriptions for that patient (fills in null values only; non-null values are preserved)
  return prescriptions.map(rx => ({
    ...rx,
    loyalty_name:  names.get(rx.patient_national_id)  ?? rx.loyalty_name  ?? null,
    loyalty_phone: phones.get(rx.patient_national_id) ?? rx.loyalty_phone ?? null,
  }));
}
