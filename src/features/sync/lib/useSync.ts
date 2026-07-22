// features/sync/lib/useSync.ts
// Sync orchestration hook — fetch -> upsert -> queue positions.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { upsertPrescriptionsBatch } from '@/entities/prescription/model/store';
import { saveSettings } from '@/entities/settings/model/store';
import { nowISO } from '@/shared/lib/excel-date';
import { invalidateAfterMutation } from '@/shared/api/mutations';
import type { SyncResult } from '@/entities/prescription/model/types';
import type { SyncProvider } from './SyncProvider';

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

  async function runSync(adapter: SyncProvider): Promise<void> {
    setState({ loading: true, error: null, result: null });
    try {
      const enriched = await adapter.fetch();

      await upsertPrescriptionsBatch(enriched);

      const now = nowISO();
      await saveSettings({
        last_sync_at: now,
        // Legacy fields zeroed out; they belong to Google Sheets specifics
        last_sync_count_sheet1: 0,
        last_sync_count_sheet2: 0,
      });

      const result: SyncResult = {
        sheet1_count: 0,
        sheet2_count: 0,
        merged_count: enriched.length,
        last_sync_at: now,
      };

      setState({ loading: false, error: null, result });

      // Invalidate only the queries affected by sync
      await invalidateAfterMutation(qc, 'sync');
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }));
    }
  }

  return { ...state, runSync };
}
