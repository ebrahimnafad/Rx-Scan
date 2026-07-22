// app/hooks/useOverdueScheduler.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { promoteScheduledPrescriptions } from '@/entities/prescription/model/store';
import { invalidateAfterMutation } from '@/shared/api/mutations';

/**
 * Runs on mount and every 60 seconds.
 * Promotes scheduled prescriptions:
 *   - scheduled_date < today → 'overdue'
 *   - scheduled_date === today → 'due_today'
 * Only invalidates queries when promotions actually occurred.
 */
export function useOverdueScheduler() {
  const qc = useQueryClient();

  useEffect(() => {
    async function check() {
      const changed = await promoteScheduledPrescriptions();
      if (!changed) return;

      await invalidateAfterMutation(qc, 'scheduleUpdate');
    }

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [qc]);
}
