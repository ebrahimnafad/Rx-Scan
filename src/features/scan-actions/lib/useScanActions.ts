// features/scan-actions/lib/useScanActions.ts
// All scan state transitions. Returns action functions + undo state.
// Each action sets a pending undo entry; calling undo() reverts the change.

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updatePrescription, getPrescriptionById, getAllPrescriptions, getDb } from '@/app/db';
import { nowISO } from '@/shared/lib/excel-date';
import { assign } from '@/features/queue/lib/queue';
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
    apply: (existing: Prescription) => Partial<Prescription>,
    sideEffect?: () => Promise<void>
  ) {
    const existing = await getPrescriptionById(rxId);
    if (!existing) return;

    const snapshot = { ...existing };
    const patch    = apply(existing);
    await updatePrescription(rxId, patch);
    if (sideEffect) await sideEffect();
    await invalidate();

    setUndoEntry({
      id: `${rxId}-${Date.now()}`,
      message,
      onUndo: async () => {
        await updatePrescription(rxId, snapshot);
        await assign(); // Always enforce queue correctness on undo
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
    }), assign);
  }

  async function skip(rxId: number) {
    // Move to back of queue — full re-sort via assign() for correctness + undo symmetry (C1)
    await withUndo(rxId, 'Prescription skipped', _ => ({
      status:     'skipped',
      updated_at: nowISO(),
    }), assign);
  }

  async function markDueToday(rxId: number) {
    await withUndo(rxId, 'Marked due today', existing => ({
      status:         'due_today',
      queue_position: null,
      scheduled_date: null,
      actioned_at:    existing.actioned_at ?? nowISO(),
      updated_at:     nowISO(),
    }), assign);
  }

  async function schedule(rxId: number, date: string) {
    await withUndo(rxId, `Scheduled for ${date}`, existing => ({
      status:         'scheduled',
      scheduled_date: date,
      queue_position: null,
      actioned_at:    existing.actioned_at ?? nowISO(),
      updated_at:     nowISO(),
    }), assign);
  }

  async function revealAllSkipped() {
    // Promote all skipped → pending so they re-enter the queue front
    const db = await getDb();
    const allRx = await getAllPrescriptions();
    const skipped = allRx.filter(rx => rx.status === 'skipped');
    const tx = db.transaction('prescriptions', 'readwrite');
    for (const rx of skipped) {
      if (!rx.id) continue;
      await tx.store.put({ ...rx, status: 'pending', updated_at: nowISO() });
    }
    await tx.done;
    // Reassign queue positions so revealed items get proper positions
    await assign();
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
