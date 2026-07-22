// features/export/lib/useExport.ts
// CSV report + JSON backup download, JSON import.
// CSV columns: Reference Number, Patient National Id, Loyalty Name, Loyalty Phone,
//              Status, Scheduled Date, Notes, Is VIP

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAllPrescriptions } from '@/entities/prescription/model/store';
import { getSettings } from '@/entities/settings/model/store';
import { restoreBackup } from '@/app/systemStore';
import { localFormat } from '@/shared/lib/phone';
import { nowISO } from '@/shared/lib/excel-date';
import { invalidateAfterMutation } from '@/shared/api/mutations';
import type { Prescription, PrescriptionStatus, Settings } from '@/entities/prescription/model/types';

/* ── Old rx-tracker backup migration ────────────────────────────────── */

interface OldRx {
  key?: string;
  insuranceApproval?: string;
  membershipId?: string;
  loyaltyName?: string;
  loyaltyPhone?: string;
  descriptions?: string[];
  netValue?: number;
  firstSeenDate?: string;   // "MM/DD/YYYY" or "DD/MM/YYYY"
  status?: string;
  dueDate?: string;         // ISO date "YYYY-MM-DD"
  createdAt?: string;
  history?: { action: string; timestamp: string; details?: string }[];
}

interface OldBackup {
  sheetUrl?: string;
  vipSheetUrl?: string;
  lastSync?: string;
  prescriptions?: Record<string, OldRx> | OldRx[];
}

function isOldFormat(data: Record<string, unknown>): boolean {
  return (
    ('sheetUrl' in data || 'vipSheetUrl' in data || 'lastSync' in data) &&
    'prescriptions' in data &&
    typeof data.prescriptions === 'object' &&
    data.prescriptions !== null
  );
}

function parseFirstSeenDate(raw?: string): string | null {
  if (!raw) return null;
  const parts = raw.split('/');
  if (parts.length !== 3) return null;
  // Detect MM/DD/YYYY vs DD/MM/YYYY by checking if first part > 12
  const a = parseInt(parts[0], 10);
  const b = parseInt(parts[1], 10);
  let month: number, day: number, year: string;
  if (a > 12) {
    // DD/MM/YYYY
    day = a; month = b; year = parts[2];
  } else if (b > 12) {
    // MM/DD/YYYY
    month = a; day = b; year = parts[2];
  } else {
    // Ambiguous — assume MM/DD/YYYY (US convention, typical of old app)
    month = a; day = b; year = parts[2];
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function deriveHistoryFields(history?: { action: string; timestamp: string }[]) {
  const result: Pick<Prescription, 'dispensed_at' | 'actioned_at' | 'notified_via' | 'notified_at'> = {
    dispensed_at: null,
    actioned_at: null,
    notified_via: null,
    notified_at: null,
  };
  if (!history) return result;
  for (const h of history) {
    if (h.action === 'dispensed' && !result.dispensed_at) {
      result.dispensed_at = h.timestamp;
    }
    if ((h.action === 'whatsapp' || h.action === 'call') && !result.notified_via) {
      result.notified_via = h.action as 'whatsapp' | 'call';
      result.notified_at = h.timestamp;
    }
  }
  return result;
}

function migrateOldBackup(data: OldBackup): { prescriptions: Prescription[]; settings: Partial<Settings> } {
  const entries = Array.isArray(data.prescriptions)
    ? data.prescriptions
    : Object.values(data.prescriptions ?? {});

  const prescriptions: Prescription[] = entries.map((rx) => {
    const key = rx.key ?? `${rx.insuranceApproval ?? ''}|${rx.membershipId ?? ''}`;
    const historyFields = deriveHistoryFields(rx.history);
    const statusMap: Record<string, PrescriptionStatus> = {
      dispensed: 'dispensed',
      scheduled: 'scheduled',
      notified: 'pending',
      queue: 'pending',
      due: 'due_today',
    };
    const status: PrescriptionStatus = statusMap[rx.status ?? ''] ?? 'pending';

    return {
      reference_number: rx.membershipId ?? key.split('|')[1] ?? '',
      patient_national_id: rx.insuranceApproval ?? key.split('|')[0] ?? '',
      loyalty_name: rx.loyaltyName ?? null,
      loyalty_phone: rx.loyaltyPhone ?? null,
      drug_name_sheet1: rx.descriptions?.[0] ?? null,
      drug_name_sheet2: rx.descriptions?.[1] ?? null,
      gross_value: rx.netValue ?? 0,
      trx_date: parseFirstSeenDate(rx.firstSeenDate),
      is_vip: false,
      status,
      scheduled_date: rx.dueDate ?? null,
      queue_position: null,
      notes: null,
      ...historyFields,
      created_at: rx.createdAt ?? nowISO(),
      updated_at: nowISO(),
    };
  });

  const settings: Partial<Settings> = {};
  if (data.sheetUrl) settings.sheet1_url = data.sheetUrl;
  if (data.vipSheetUrl) settings.sheet2_url = data.vipSheetUrl;

  return { prescriptions, settings };
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(v: string | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function useExport() {
  const [importing, setImporting] = useState(false);
  const qc = useQueryClient();

  async function exportCsv() {
    const rxs = await getAllPrescriptions();
    const headers = [
      'Reference Number', 'Patient National Id', 'Loyalty Name', 'Loyalty Phone',
      'Status', 'Scheduled Date', 'Notes', 'Is VIP',
    ];
    const rows = rxs.map(rx => [
      escapeCsv(rx.reference_number),
      escapeCsv(rx.patient_national_id),
      escapeCsv(rx.loyalty_name),
      escapeCsv(localFormat(rx.loyalty_phone)),
      escapeCsv(rx.status),
      escapeCsv(rx.scheduled_date),
      escapeCsv(rx.notes),
      rx.is_vip ? 'Yes' : 'No',
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(csv, `rxscan-report-${date}.csv`, 'text/csv');
  }

  async function exportJson() {
    const [rxs, settings] = await Promise.all([getAllPrescriptions(), getSettings()]);
    const backup = { version: 1, exported_at: nowISO(), settings, prescriptions: rxs };
    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(JSON.stringify(backup, null, 2), `rxscan-backup-${date}.json`, 'application/json');
  }

  async function importJson(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const raw: Record<string, unknown> = JSON.parse(text);

      let prescriptions: Prescription[];
      let settingsPatch: Partial<Settings> = {};

      if (isOldFormat(raw)) {
        const migrated = migrateOldBackup(raw as unknown as OldBackup);
        prescriptions = migrated.prescriptions;
        settingsPatch = migrated.settings;
      } else {
        const data = raw as Record<string, unknown> as { prescriptions?: Prescription[]; settings?: Partial<Settings> };
        prescriptions = data.prescriptions ?? [];
        settingsPatch = data.settings ?? {};
      }

      await restoreBackup(prescriptions, settingsPatch);
      await invalidateAfterMutation(qc, 'importJson');
    } finally {
      setImporting(false);
    }
  }

  return { exportCsv, exportJson, importJson, importing };
}
