// features/sync/lib/useSync.ts
// Sync orchestration hook — fetch → parse → merge → enrich → upsert → queue positions.
// Handles both URL-based and paste-based sync.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchSheetCsv } from '@/shared/api/sheets';
import { parseSheet1 } from './parseSheet1';
import { parseSheet2 } from './parseSheet2';
import { fullOuterMerge, patientEnrichment } from '@/entities/prescription/lib/dedup';
import { surgicalUpsert } from './upsert';
import { assign } from '@/features/queue/lib/queue';
import { saveSettings } from '@/app/db';
import { nowISO } from '@/shared/lib/excel-date';
import { invalidateAfterMutation } from '@/shared/api/mutations';
import type { SyncResult } from '@/entities/prescription/model/types';

/** Validates that a URL is a proper Google Sheets CSV export URL. */
export function validateSheetUrl(url: string): string | null {
  if (!url.trim()) return 'URL is required';
  if (!url.includes('export?format=csv') && !url.includes('output=csv') && !url.includes('pub?output=csv')) {
    return 'URL must contain "export?format=csv" — use File → Share → Publish to web → CSV';
  }
  try { new URL(url); } catch { return 'Invalid URL format'; }
  return null;
}

export interface SyncState {
  loading: boolean;
  error: string | null;
  result: SyncResult | null;
}

export function useSync() {
  const qc = useQueryClient();
  const [state, setState] = useState<SyncState>({ loading: false, error: null, result: null });

  async function syncFromUrls(sheet1Url?: string, sheet2Url?: string): Promise<void> {
    setState({ loading: true, error: null, result: null });
    try {
      const [csv1, csv2] = await Promise.all([
        sheet1Url ? fetchSheetCsv(sheet1Url) : Promise.resolve(''),
        sheet2Url ? fetchSheetCsv(sheet2Url) : Promise.resolve(''),
      ]);
      await _runSync(csv1, csv2);
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }

  async function syncFromPaste(sheet1Csv?: string, sheet2Csv?: string): Promise<void> {
    setState({ loading: true, error: null, result: null });
    try {
      await _runSync(sheet1Csv ?? '', sheet2Csv ?? '');
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }

  async function _runSync(csv1: string, csv2: string): Promise<void> {
    const s1 = csv1 ? parseSheet1(csv1) : [];
    const s2 = csv2 ? parseSheet2(csv2) : [];

    const merged  = fullOuterMerge(s1, s2);
    const enriched = patientEnrichment(merged);

    await surgicalUpsert(enriched);
    await assign();

    const now = nowISO();
    await saveSettings({
      last_sync_at:           now,
      last_sync_count_sheet1: s1.length,
      last_sync_count_sheet2: s2.length,
    });

    const result: SyncResult = {
      sheet1_count: s1.length,
      sheet2_count: s2.length,
      merged_count: enriched.length,
      last_sync_at: now,
    };

    setState({ loading: false, error: null, result });

    // Invalidate only the queries affected by sync
    await invalidateAfterMutation(qc, 'sync');
  }

  return { ...state, syncFromUrls, syncFromPaste };
}
