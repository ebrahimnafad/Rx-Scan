// widgets/prescription-card/Card.tsx
// Unified prescription card — one deep module replacing 3 shallow widgets.
// Variants: 'front' | 'back' | 'row' (for PrescriptionList)

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { Edit2, Phone, MessageCircle, XCircle, ChevronDown, Calendar, CheckCircle2, ArrowDown } from 'lucide-react';
import { NeumorphicCard } from '@/shared/ui/NeumorphicCard';
import { NeumorphicButton } from '@/shared/ui/NeumorphicButton';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { VipBadge } from '@/shared/ui/VipBadge';
import { BarcodeVisual } from '@/shared/lib/barcode/BarcodeVisual';
import { whatsappLink, callLink, localFormat, buildWhatsAppMessage } from '@/shared/lib/phone';
import { todayISO, tomorrowISO, nowISO } from '@/shared/lib/excel-date';
import { updatePrescription } from '@/app/db';
import type { Prescription, Settings } from '@/entities/prescription/model/types';
import { BEAM } from '@/shared/config/beam';

export type CardVariant = 'front' | 'back' | 'row';

export interface CardProps {
  rx: Prescription;
  variant: CardVariant;
  settings?: Settings;
  onTap?: () => void;
  onInfoChange?: (id: number, name: string | null, phone: string | null) => void;
  onNoteChange?: (id: number, note: string) => void;
  onReAction?: (id: number, action: 'dispense' | 'due_today' | 'schedule', date?: string) => void;
  onNotify?: (via: 'whatsapp' | 'call') => void;
  onScheduleConfirm?: () => void;
  onScheduleCancel?: () => void;
  showSchedule?: boolean;
  scheduleDate?: string;
  onScheduleDateChange?: (date: string) => void;
  style?: React.CSSProperties;
}


export function Card({
  rx,
  variant,
  settings,
  onTap,
  onInfoChange,
  onNoteChange,
  onReAction,
  onNotify,
  onScheduleConfirm,
  onScheduleCancel,
  showSchedule = false,
  scheduleDate,
  onScheduleDateChange,
  style,
}: CardProps) {
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState(rx.loyalty_name ?? '');
  const [editPhone, setEditPhone] = useState(rx.loyalty_phone ?? '');
  const [note, setNote] = useState(rx.notes ?? '');
  const [localShowSchedule, setLocalShowSchedule] = useState(showSchedule);
  useEffect(() => {
    setLocalShowSchedule(showSchedule);
  }, [showSchedule]);
  const [localScheduleDate, setLocalScheduleDate] = useState(scheduleDate ?? tomorrowISO());

  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationDays = settings?.notified_light_duration_days;

  // B7 fix: compute remaining time from notified_at, not from mount time
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const rxId = rx.id;
    const notifiedAt = rx.notified_at ? Date.parse(rx.notified_at) : null;
    if (notifiedAt && durationDays && durationDays > 0 && rxId) {
      const remaining = (notifiedAt + durationDays * 86_400_000) - Date.now();
      if (remaining <= 0) {
        // Already expired — reset immediately
        updatePrescription(rxId, { notified_via: null, notified_at: null, updated_at: nowISO() })
          .then(() => qc.invalidateQueries({ queryKey: ['prescriptions'] }));
      } else {
        timerRef.current = setTimeout(async () => {
          await updatePrescription(rxId, { notified_via: null, notified_at: null, updated_at: nowISO() });
          qc.invalidateQueries({ queryKey: ['prescriptions'] });
        }, remaining);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rx.notified_via, rx.notified_at, durationDays]);

  const drugName = variant === 'back'
    ? (rx.drug_name_sheet2 ?? rx.drug_name_sheet1 ?? '—')
    : (rx.drug_name_sheet1 ?? rx.drug_name_sheet2 ?? '—');

  const phone = rx.loyalty_phone;
  const waMsg = buildWhatsAppMessage(rx, settings);
  const waLink = whatsappLink(phone, waMsg);
  const callHref = callLink(phone);
  const beam = rx.notified_via ? BEAM[rx.notified_via] : null;

  const cardStyle: React.CSSProperties = {
    padding: variant === 'row' ? 0 : '20px',
    cursor: onTap ? 'pointer' : 'default',
    userSelect: 'none',
    display: 'flex',
    flexDirection: 'column',
    ...style,
  };

  // ── Front face ──────────────────────────────────────────────
  if (variant === 'front') {
    return (
      <NeumorphicCard onClick={onTap} style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {rx.is_vip && <VipBadge size="sm" />}
          </div>
          <StatusBadge status={rx.status} size="sm" />
        </div>

        <div className="mb-4 relative w-full z-10">
          {isEditingInfo && (
            <div className="absolute top-0 inset-x-0 space-y-2 p-3 rounded-xl bg-surface shadow-neu-inset z-20" onClick={e => e.stopPropagation()}>
              <div className="flex gap-2">
                <input
                  value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder="Patient Name"
                  className="flex-1 w-full rounded-xl p-2.5 text-xs outline-none bg-surface shadow-neu-inset text-text-primary placeholder:text-text-muted font-[inherit]"
                />
                <input
                  value={editPhone} onChange={e => setEditPhone(e.target.value)}
                  placeholder="Phone (966...)"
                  className="flex-1 w-full rounded-xl p-2.5 text-xs outline-none bg-surface shadow-neu-inset text-text-primary placeholder:text-text-muted font-[inherit]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditName(rx.loyalty_name ?? ''); setEditPhone(rx.loyalty_phone ?? ''); setIsEditingInfo(false); }}
                  className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-text-muted border-none cursor-pointer hover:shadow-neu-pressed transition-shadow"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { rx.id && onInfoChange?.(rx.id, editName || null, editPhone || null); setIsEditingInfo(false); }}
                  className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white shadow-neu-btn border-none cursor-pointer hover:shadow-neu-pressed transition-shadow"
                >
                  Save
                </button>
              </div>
            </div>
          )}
          <div className="space-y-1 relative" style={{ opacity: isEditingInfo ? 0 : 1, pointerEvents: isEditingInfo ? 'none' : 'auto' }}>
            {onInfoChange && (
              <button
                onClick={e => { e.stopPropagation(); setIsEditingInfo(true); }}
                className="absolute -top-1 right-0 p-2 rounded-lg text-text-secondary hover:text-primary bg-surface/80 hover:bg-surface shadow-neu-sm hover:shadow-neu-btn border-none cursor-pointer transition-all z-10"
                title="Edit Patient Info"
              >
                <Edit2 size={15} />
              </button>
            )}
            <p className="m-0 pr-6 text-base font-semibold text-text-primary leading-tight truncate">
              {rx.loyalty_name ?? 'Unknown Patient'}
            </p>
            <p className="m-0 text-sm text-text-secondary truncate" title={drugName}>
              {drugName.length > 50 ? drugName.slice(0, 50) + '…' : drugName}
            </p>
            <div className="flex items-center gap-3 mt-1">
              {rx.gross_value > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface shadow-neu-sm text-[11px] text-text-primary font-bold">
                  {rx.gross_value.toFixed(2)} SAR
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center mb-2">
          <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-widest mb-2 m-0">Patient ID Barcode</p>
          <div className="rounded-xl bg-white px-4 py-3 shadow-neu-sm w-full">
            <BarcodeVisual data={rx.patient_national_id} height={110} />
          </div>
        </div>

        <div className="flex-1" />

        <p className="text-center text-[10px] text-text-muted mt-3 mb-0">Tap to see Reference Number →</p>

        {rx.notes && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-surface shadow-neu-inset">
            <p className="text-[11px] text-text-secondary m-0 leading-relaxed line-clamp-2">📝 {rx.notes}</p>
          </div>
        )}
      </NeumorphicCard>
    );
  }

  // ── Back face ───────────────────────────────────────────────
  if (variant === 'back') {
    const cardStyleWithBeam: React.CSSProperties = {
      ...cardStyle,
      position: 'relative',
      overflow: beam ? 'hidden' : 'visible',
    };

    return (
      <NeumorphicCard onClick={onTap} style={cardStyleWithBeam}>
        {beam && (
            <div className="absolute bottom-0 inset-x-0 pointer-events-none z-0" style={{ height: 56, borderRadius: 'inherit', overflow: 'hidden' }}>
              <div className="absolute inset-x-0 bottom-0 h-1 rounded-t-md" style={{ backgroundColor: beam.color, boxShadow: `0 0 14px 4px ${beam.glow}` }} />
            </div>
          )}

        <div className="relative flex items-center justify-between mb-2 z-10">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {rx.is_vip && <VipBadge size="sm" />}
            <p className="m-0 text-base font-semibold text-text-primary leading-tight truncate">
              {rx.loyalty_name ?? 'Unknown Patient'}
            </p>
          </div>
          <StatusBadge status={rx.status} size="sm" />
        </div>
        <p className="relative z-10 m-0 mb-3 text-sm text-text-secondary truncate" title={drugName}>
          {drugName.length > 50 ? drugName.slice(0, 50) + '…' : drugName}
        </p>

        {localShowSchedule && (
          <div className="relative z-20 w-full px-3 py-3 mb-3 rounded-xl bg-surface shadow-neu-inset">
            <p className="text-[11px] text-text-muted m-0 mb-2 uppercase tracking-wide">Schedule for date</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={localScheduleDate}
                min={todayISO()}
                onChange={e => { setLocalScheduleDate(e.target.value); onScheduleDateChange?.(e.target.value); }}
                onClick={e => e.stopPropagation()}
                className="flex-1 bg-surface shadow-neu-inset rounded-xl px-3 py-2 text-sm text-text-primary border-none outline-none font-[inherit]"
              />
              <NeumorphicButton onClick={() => { onScheduleConfirm?.(); setLocalShowSchedule(false); }} variant="primary" size="sm">Confirm</NeumorphicButton>
              <button onClick={e => { e.stopPropagation(); onScheduleCancel?.(); setLocalShowSchedule(false); }} className="p-2 rounded-xl bg-surface shadow-neu-btn text-text-muted border-none cursor-pointer"><XCircle size={16} /></button>
            </div>
          </div>
        )}

        {!localShowSchedule && (
          <div className="relative flex flex-col items-center justify-center mb-2 z-10">
            <p className="text-[10px] text-text-secondary font-semibold uppercase tracking-widest mb-2 m-0">Reference Number Barcode</p>
            <div className="rounded-xl bg-white px-4 py-3 shadow-neu-sm w-full">
              <BarcodeVisual data={rx.reference_number} height={110} />
            </div>
          </div>
        )}

        <div className="flex-1 relative z-10" />

        <div className="relative flex justify-between text-[11px] text-text-muted mb-4 z-10">
          <span>Patient ID: <span className="font-mono text-text-secondary">{rx.patient_national_id}</span></span>
        </div>

        <div className="relative flex gap-2 z-10">
          <a
            href={callHref ?? undefined}
            onClick={e => { e.stopPropagation(); if (!callHref) { e.preventDefault(); return; } onNotify?.('call'); }}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold',
              'transition-all duration-150',
              callHref ? 'bg-surface shadow-neu-btn text-primary hover:shadow-neu-btn-pressed' : 'bg-surface/60 text-text-muted cursor-not-allowed opacity-50',
            ].join(' ')}
          >
            <Phone size={14} /> Call Patient
          </a>
          <a
            href={waLink ?? undefined}
            target="_blank"
            rel="noreferrer"
            onClick={e => { e.stopPropagation(); if (!waLink) { e.preventDefault(); return; } onNotify?.('whatsapp'); }}
            className={[
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold',
              'transition-all duration-150',
              waLink ? 'bg-surface shadow-neu-btn text-success hover:shadow-neu-btn-pressed' : 'bg-surface/60 text-text-muted cursor-not-allowed opacity-50',
            ].join(' ')}
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
        </div>

        <p className="relative text-center text-[10px] text-text-muted mt-3 mb-0 z-10">← Tap to flip back</p>
      </NeumorphicCard>
    );
  }

  // ── Row variant (for PrescriptionList) ──────────────────────
  if (variant === 'row') {
    const [expanded, setExpanded] = useState(false);
    const [showSched, setShowSched] = useState(false);
    const [schedDate, setSchedDate] = useState(tomorrowISO());

    const cardRowStyle: React.CSSProperties = {
      padding: 0,
      overflow: beam ? 'hidden' : 'visible',
      position: 'relative',
      border: '6px solid rgba(255,255,255,0.5)',
    };

    return (
      <NeumorphicCard style={cardRowStyle}>
        {beam && (
          <div className="absolute bottom-0 inset-x-0 pointer-events-none z-0" style={{ height: 56, borderRadius: 'inherit', overflow: 'hidden' }}>
            <div className="absolute inset-x-0 bottom-0 h-1 rounded-t-md" style={{ backgroundColor: beam.color, boxShadow: `0 0 14px 4px ${beam.glow}` }} />
          </div>
        )}
        <div className="flex items-start gap-3 p-4 cursor-pointer relative z-10" onClick={() => setExpanded(e => !e)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold text-text-primary truncate">{rx.loyalty_name ?? 'Unknown Patient'}</span>
              {rx.is_vip && <VipBadge size="sm" />}
            </div>
            <p className="text-[11px] text-text-muted m-0 font-mono">{rx.reference_number}</p>
            {drugName && <p className="text-xs text-text-secondary m-0 mt-0.5 truncate">{drugName}</p>}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <StatusBadge status={rx.status} size="sm" />
            {rx.scheduled_date && <span className="text-[10px] text-text-muted">{rx.scheduled_date}</span>}
            <ChevronDown size={14} className="text-text-muted transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3 border-t border-surface">
                <div className="pt-3 grid grid-cols-2 gap-2 text-xs text-text-muted relative">
                  <button onClick={e => { e.stopPropagation(); setIsEditingInfo(true); }} className="absolute -top-1 right-0 p-2 rounded-lg text-text-secondary hover:text-primary bg-surface/80 hover:bg-surface shadow-neu-sm hover:shadow-neu-btn border-none cursor-pointer transition-all" title="Edit Patient Info"><Edit2 size={15} /></button>
                  <span>ID: <span className="font-mono text-text-secondary">{rx.patient_national_id}</span></span>
                  {rx.gross_value > 0 && <span className="font-bold text-text-primary">{rx.gross_value.toFixed(2)} SAR</span>}
                  {phone && <span>{localFormat(phone)}</span>}
                </div>

                {phone && (
                  <div className="flex gap-2">
                    <a href={callHref ?? undefined} onClick={e => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-primary"><Phone size={13} /> Call</a>
                    <a href={waLink ?? undefined} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-success"><MessageCircle size={13} /> WhatsApp</a>
                  </div>
                )}

                <div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => rx.id && onNoteChange?.(rx.id, note)} rows={2} placeholder="Add a note…" onClick={e => e.stopPropagation()} className="w-full rounded-xl p-2.5 text-xs resize-none outline-none bg-surface shadow-neu-inset text-text-primary placeholder:text-text-muted font-[inherit]" />
                </div>

                {['dispensed', 'scheduled', 'due_today', 'overdue'].includes(rx.status) && (
                  <div className="space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      {rx.status !== 'dispensed' && (
                        <button onClick={e => { e.stopPropagation(); rx.id && onReAction?.(rx.id, 'dispense'); }} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-success border-none cursor-pointer"><CheckCircle2 size={12} /> Dispense</button>
                      )}
                      <button onClick={e => { e.stopPropagation(); rx.id && onReAction?.(rx.id, 'due_today'); }} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-warning border-none cursor-pointer"><ArrowDown size={12} /> Due Today</button>
                      <button onClick={e => { e.stopPropagation(); setShowSched(s => !s); }} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-primary border-none cursor-pointer"><Calendar size={12} /> Schedule</button>
                    </div>

                    {showSched && (
                      <div className="flex gap-2 items-center">
                        <input type="date" value={schedDate} min={todayISO()} onClick={e => e.stopPropagation()} onChange={e => { setSchedDate(e.target.value); onReAction?.(rx.id ?? 0, 'schedule', e.target.value); setShowSched(false); }} className="flex-1 bg-surface shadow-neu-inset rounded-xl px-3 py-2 text-xs text-text-primary border-none outline-none font-[inherit]" />
                        <button onClick={e => { e.stopPropagation(); rx.id && onReAction?.(rx.id, 'schedule', schedDate); setShowSched(false); }} className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-white border-none cursor-pointer shadow-neu-btn">Confirm</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </NeumorphicCard>
    );
  }

  return null;
}