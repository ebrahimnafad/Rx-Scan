// entities/prescription/lib/view.ts
// Shared list/scan view logic: search predicate + sort comparator.
// Used by both the prescription list and the scan deck so the two views always
// agree on which cards match and in what order.

import { phoneMatchesQuery } from '@/shared/lib/phone';
import { STATUS_URGENCY } from './status';
import type { Prescription, SortKey } from '../model/types';

export const SORT_KEYS: SortKey[] = [
  'scheduled_date',
  'loyalty_name',
  'status_urgency',
  'gross_value',
  'notified',
];

export function isSortKey(value: string | null): value is SortKey {
  return !!value && (SORT_KEYS as string[]).includes(value);
}

export function matchesQuery(rx: Prescription, q: string): boolean {
  if (!q.trim()) return true;
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [
    rx.loyalty_name,
    rx.patient_national_id,
    rx.reference_number,
    rx.drug_name_sheet1,
    rx.drug_name_sheet2,
    rx.notes,
  ].filter(Boolean).join(' ').toLowerCase();
  return tokens.every(t => haystack.includes(t))
    || phoneMatchesQuery(rx.loyalty_phone, q);
}

export function applySort(rxs: Prescription[], sort: SortKey, sortDir: 'asc' | 'desc'): Prescription[] {
  const m = sortDir === 'asc' ? 1 : -1;
  return [...rxs].sort((a, b) => {
    switch (sort) {
      case 'scheduled_date':
        return m * (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '');
      case 'loyalty_name':
        return m * (a.loyalty_name ?? '').localeCompare(b.loyalty_name ?? '');
      case 'gross_value':
        return m * (a.gross_value - b.gross_value);
      case 'notified': {
        const aT = a.notified_at ?? '';
        const bT = b.notified_at ?? '';
        if (aT && !bT) return -m;
        if (!aT && bT) return m;
        return m * aT.localeCompare(bT);
      }
      case 'status_urgency':
      default:
        return m * (STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status]);
    }
  });
}
