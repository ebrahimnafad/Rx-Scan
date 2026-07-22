// features/scan-actions/lib/useScanActions.ts
// All scan state transitions. Returns action functions + undo state.
// Each action sets a pending undo entry; calling undo() reverts the change.

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updatePrescription, getPrescriptionById, revealAllSkippedPrescriptions } from '@/entities/prescription/model/store';
import { nowISO } from '@/shared/lib/excel-date';
import { invalidateAfterMutation } from '@/shared/api/mutations';
import type { Prescription } from '@/entities/prescription/model/types';

export interface UndoEntry {
  id: string;
  message: string;
  onUndo: () => Promise<void>;
}

export function useScanActions() {
  const qc = useQueryClient();
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);

  const invalidate = useCallback(async () => {
    await invalidateAfterMutation(qc, 'scanAction');
  }, [qc]);

  // Saves previous state for undo, applies patch, schedules undo expiry
  async function withUndo(
    rxId: number,
    message: string,
    apply: (existing: Prescription) => Partial<Prescription>
  ) {
    const existing = await getPrescriptionById(rxId);
    if (!existing) return;

    const snapshot = { ...existing };
    const patch    = apply(existing);
    await updatePrescription(rxId, patch);
    await invalidate();

    setUndoEntry({
      id: `${rxId}-${Date.now()}`,
      message,
      onUndo: async () => {
        await updatePrescription(rxId, snapshot);
        await invalidate();
      },
    });
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function dispense(rxId: number) {
    await withUndo(rxId, 'Prescription dispensed', existing => ({
      status:         'dispensed',
      queue_position: null,
      scheduled_date: null,
      dispensed_at:   nowISO(),
      actioned_at:    existing.actioned_at ?? nowISO(),
      updated_at:     nowISO(),
    }));
  }

  async function skip(rxId: number) {
    await withUndo(rxId, 'Prescription skipped', _ => ({
      status:     'skipped',
      updated_at: nowISO(),
    }));
  }

  async function markDueToday(rxId: number) {
    await withUndo(rxId, 'Marked due today', existing => ({
      status:         'due_today',
      queue_position: null,
      scheduled_date: null,
      actioned_at:    existing.actioned_at ?? nowISO(),
      updated_at:     nowISO(),
    }));
  }

  async function schedule(rxId: number, date: string) {
    await withUndo(rxId, `Scheduled for ${date}`, existing => ({
      status:         'scheduled',
      scheduled_date: date,
      queue_position: null,
      actioned_at:    existing.actioned_at ?? nowISO(),
      updated_at:     nowISO(),
    }));
  }

  async function revealAllSkipped() {
    await revealAllSkippedPrescriptions();
    await invalidate();
  }

  async function updateInfo(rxId: number, name: string | null, phone: string | null) {
    await withUndo(rxId, 'Patient info updated', () => ({
      loyalty_name:  name,
      loyalty_phone: phone,
      updated_at:   nowISO(),
    }));
  }

  async function notify(rxId: number, via: 'whatsapp' | 'call') {
    await withUndo(rxId, `Notified via ${via}`, () => ({
      notified_via: via,
      notified_at:  nowISO(),
      updated_at:   nowISO(),
    }));
  }

  function dismissUndo() {
    setUndoEntry(null);
  }

  return { dispense, skip, markDueToday, schedule, revealAllSkipped, updateInfo, notify, undoEntry, dismissUndo, invalidate };
}
