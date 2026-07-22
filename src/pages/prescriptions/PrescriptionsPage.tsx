// pages/prescriptions/PrescriptionsPage.tsx
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { getAllPrescriptions, updatePrescription } from '@/entities/prescription/model/store';
import { getSettings } from '@/entities/settings/model/store';
import { PrescriptionList } from '@/widgets/prescription-list/PrescriptionList';
import { NeumorphicCard } from '@/shared/ui/NeumorphicCard';
import { UndoToastManager } from '@/shared/ui/UndoToast';
import { useScanActions } from '@/features/scan-actions/lib/useScanActions';
import { invalidateAfterMutation } from '@/shared/api/mutations';
import { nowISO } from '@/shared/lib/excel-date';
import type { FilterKey } from '@/entities/prescription/model/types';
import { queryKeys } from '@/shared/api/queryKeys';

export default function PrescriptionsPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const rawFilter = searchParams.get('filter');
  const validFilters: FilterKey[] = ['all', 'urgent', 'pending', 'skipped', 'vip', 'scheduled', 'dispensed'];
  const urlFilter = rawFilter && validFilters.includes(rawFilter as FilterKey)
    ? (rawFilter as FilterKey) : undefined;

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: queryKeys.prescriptions.all(),
    queryFn: getAllPrescriptions,
    staleTime: 30_000,
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.settings.all(),
    queryFn: getSettings,
    staleTime: 30_000,
  });

  const { dispense, markDueToday, schedule, updateInfo, notify, undoEntry, dismissUndo } =
    useScanActions();

  const handleNoteChange = useCallback(async (id: number, note: string) => {
    await updatePrescription(id, { notes: note, updated_at: nowISO() });
    invalidateAfterMutation(qc, 'noteChange');
  }, [qc]);

  const handleReAction = useCallback(async (
    id: number,
    action: 'dispense' | 'due_today' | 'schedule',
    date?: string
  ) => {
    if (action === 'dispense') await dispense(id);
    else if (action === 'due_today') await markDueToday(id);
    else if (action === 'schedule' && date) await schedule(id, date);
  }, [dispense, markDueToday, schedule]);

  return (
    <div className="pb-28">
      {!isLoading && prescriptions.length === 0 && (
        <NeumorphicCard style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-lg font-bold text-text-primary m-0 mb-2">No prescriptions yet</h2>
          <p className="text-sm text-text-muted m-0">
            Go to Settings → Sheet Sync to import your prescription data.
          </p>
        </NeumorphicCard>
      )}

      {prescriptions.length > 0 && (
        <PrescriptionList
          prescriptions={prescriptions}
          settings={settings}
          initialFilter={urlFilter}
          onNoteChange={handleNoteChange}
          onInfoChange={updateInfo}
          onReAction={handleReAction}
          onNotify={notify}
        />
      )}

      <UndoToastManager action={undoEntry} onDismiss={dismissUndo} />
    </div>
  );
}
