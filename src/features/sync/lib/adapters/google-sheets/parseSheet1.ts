// features/sync/lib/parseSheet1.ts
// Parses Sheet 1 (Invoices Details) CSV rows into Sheet1Row objects.
// Column mapping (by header name, NOT by position):
//   Membership ID       → reference_number
//   Insurance Approval  → patient_national_id
//   Description         → drug_name_sheet1
//   Loyalty Name        → loyalty_name
//   Loyalty Phone       → loyalty_phone (normalised to 966XXXXXXXXX)
//   Trx Date            → trx_date (ISO YYYY-MM-DD from Excel serial)
//   Gross Value         → gross_value (float, default 0)
//
// IGNORED: Is Insurance Approval, Max Refill Notify Date (per ADR notes)

import type { Sheet1Row } from '@/entities/prescription/model/types';
import { normalizePhone, cleanPhone } from '@/shared/lib/phone';
import { excelSerialToISO } from '@/shared/lib/excel-date';
import { splitCsvLine, fieldByHeader } from '@/shared/lib/csv';

const SENTINELS_NAME = new Set(['NON LOYALTY CUSTOMERS', '']);

function cleanLoyaltyName(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  return SENTINELS_NAME.has(s) ? null : s;
}



export function parseSheet1(csv: string): Sheet1Row[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Sheet1Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const get = (name: string) => fieldByHeader(headers, cols, name);

    const refRaw    = get('Membership ID');
    const natIdRaw  = get('Insurance Approval');
    if (!refRaw || !natIdRaw) continue; // skip rows without dedup key

    const ref   = refRaw.replace(/^"|"$/g, '').trim();
    const natId = natIdRaw.replace(/^"|"$/g, '').trim();
    if (!ref || !natId) continue;

    const trxDateRaw  = get('Trx Date');
    const trxDate     = trxDateRaw
      ? (isNaN(Number(trxDateRaw))
          ? trxDateRaw.slice(0, 10)             // already ISO-ish string
          : excelSerialToISO(Number(trxDateRaw))) // Excel serial
      : null;

    const phoneRaw = get('Loyalty Phone');
    const phone    = normalizePhone(phoneRaw);

    const grossRaw  = get('Gross Value');
    const gross     = grossRaw ? parseFloat(grossRaw) || 0 : 0;

    rows.push({
      reference_number:    ref,
      patient_national_id: natId,
      drug_name_sheet1:    get('Description')?.trim() || null,
      loyalty_name:        cleanLoyaltyName(get('Loyalty Name')),
      loyalty_phone:       cleanPhone(phone),
      trx_date:            trxDate,
      gross_value:         gross,
    });
  }

  return rows;
}


