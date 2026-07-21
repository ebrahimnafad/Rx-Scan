// shared/ui/StatusBadge.tsx â€” RxScan prescription status badges

import type { PrescriptionStatus } from '@/entities/prescription/model/types';
import { STATUS_LABEL } from '@/entities/prescription/lib/status';

interface StatusBadgeProps {
  status: PrescriptionStatus;
  size?: 'sm' | 'md';
}

const STATUS_STYLES: Record<PrescriptionStatus, { bg: string; text: string }> = {
  pending:   { bg: 'rgba(160,174,192,0.15)', text: '#A0AEC0' },
  skipped:   { bg: 'rgba(160,174,192,0.15)', text: '#A0AEC0' },
  dispensed: { bg: 'rgba(10,207,131,0.15)', text: '#0ACF83' },
  scheduled: { bg: 'rgba(24,98,245,0.15)', text: '#1862F5' },
  due_today: { bg: 'rgba(232,201,143,0.2)',  text: '#B8860B' },
  overdue:   { bg: 'rgba(255,51,102,0.2)',  text: '#FF3366' },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
      ].join(' ')}
      style={{ background: styles.bg, color: styles.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: styles.text }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}



