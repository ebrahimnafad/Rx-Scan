// entities/prescription/lib/status.ts
import type { PrescriptionStatus } from '../model/types';

export const STATUS_LABEL: Record<PrescriptionStatus, string> = {
  pending:   'Pending',
  skipped:   'Skipped',
  dispensed: 'Dispensed',
  scheduled: 'Scheduled',
  due_today: 'Due Today',
  overdue:   'Overdue',
};

// Tailwind bg class for each status (mapped to @theme tokens)
export const STATUS_COLOR: Record<PrescriptionStatus, string> = {
  pending:   'bg-text-muted',
  skipped:   'bg-text-muted',
  dispensed: 'bg-success',
  scheduled: 'bg-primary',
  due_today: 'bg-warning',
  overdue:   'bg-danger',
};

// Text color for inline use
export const STATUS_TEXT_COLOR: Record<PrescriptionStatus, string> = {
  pending:   'text-text-muted',
  skipped:   'text-text-muted',
  dispensed: 'text-success',
  scheduled: 'text-primary',
  due_today: 'text-warning',
  overdue:   'text-danger',
};

export const QUEUE_STATUSES: PrescriptionStatus[] = ['pending', 'skipped', 'due_today', 'overdue'];
export const ACTED_STATUSES: PrescriptionStatus[] = ['dispensed', 'scheduled', 'due_today', 'overdue'];

export function isActioned(status: PrescriptionStatus): boolean {
  return ACTED_STATUSES.includes(status);
}

export function isInQueue(status: PrescriptionStatus): boolean {
  return QUEUE_STATUSES.includes(status);
}

/** Urgency sort weight — higher = show first */
export const STATUS_URGENCY: Record<PrescriptionStatus, number> = {
  overdue:   4,
  due_today: 3,
  pending:   2,
  skipped:   1,
  scheduled: 0,
  dispensed: 0,
};
