// features/sync/lib/parseSheet2.ts
// Parses Sheet 2 (VIP Approved RXs) CSV rows into Sheet2Row objects.
// Column mapping (by header name):
//   Reference Number      → reference_number
//   Patient National Id   → patient_national_id
//   Generic name          → drug_name_sheet2
//   Patient Contact Number→ loyalty_phone (normalised to 966XXXXXXXXX)
//
// IGNORED: Branch, Max Refill Notify Date (per ADR notes)

import type { Sheet2Row } from '@/entities/prescription/model/types';
import { normalizePhone, cleanPhone } from '@/shared/lib/phone';
import { splitCsvLine, fieldByHeader } from '@/shared/lib/csv';



export function parseSheet2(csv: string): Sheet2Row[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Sheet2Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const get = (name: string) => fieldByHeader(headers, cols, name);

    const refRaw   = get('Reference Number');
    const natIdRaw = get('Patient National Id');
    if (!refRaw || !natIdRaw) continue;

    const ref   = refRaw.replace(/^"|"$/g, '').trim();
    const natId = natIdRaw.replace(/^"|"$/g, '').trim();
    if (!ref || !natId) continue;

    const phoneRaw = get('Patient Contact Number');
    const phone    = normalizePhone(phoneRaw);

    rows.push({
      reference_number:    ref,
      patient_national_id: natId,
      drug_name_sheet2:    get('Generic name')?.trim() || null,
      loyalty_phone:       cleanPhone(phone),
    });
  }

  return rows;
}
