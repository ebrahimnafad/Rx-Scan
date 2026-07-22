// app/hooks/useBadgeCounts.ts
import { useQuery } from '@tanstack/react-query';
import { countAllStatuses } from '@/entities/prescription/model/store';

export function useBadgeCounts() {
  const { data } = useQuery({
    queryKey: ['count'],
    queryFn: countAllStatuses,
    refetchInterval: 60_000,
  });

  return {
    urgentCount: (data?.due_today ?? 0) + (data?.overdue ?? 0),
    overdueCount: data?.overdue ?? 0,
    pendingCount: data?.pending ?? 0,
  };
}
