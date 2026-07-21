// app/hooks/useOverdueScheduler.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { promoteScheduled } from '@/features/queue/lib/queue';

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
      const changed = await promoteScheduled();
      if (!changed) return;

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['prescriptions', 'all'] }),
        qc.invalidateQueries({ queryKey: ['count'] }),
        qc.invalidateQueries({ queryKey: ['scan'] }),
      ]);
    }

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [qc]);
}
