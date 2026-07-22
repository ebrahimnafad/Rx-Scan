// widgets/prescription-list/PrescriptionList.tsx
// Filterable, searchable, sortable list of all prescriptions.
// Supports inline note editing and re-action drawer.

import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, X, ChevronDown, ChevronRight, MessageCircle, Phone,
  ArrowDown, Calendar, CheckCircle2, SlidersHorizontal, Edit2,
  ScanLine, Scan
} from 'lucide-react';
import { NeumorphicCard } from '@/shared/ui/NeumorphicCard';
import { NeumorphicButton } from '@/shared/ui/NeumorphicButton';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { VipBadge } from '@/shared/ui/VipBadge';
import { FilterBar } from './FilterBar';
import { whatsappLink, callLink, localFormat, phoneMatchesQuery, buildWhatsAppMessage } from '@/shared/lib/phone';
import { BarcodeVisual } from '@/shared/lib/barcode/BarcodeVisual';
import { STATUS_URGENCY } from '@/entities/prescription/lib/status';
import type { PrescriptionStatus } from '@/entities/prescription/model/types';
import { todayISO, tomorrowISO } from '@/shared/lib/excel-date';
import { updatePrescription } from '@/entities/prescription/model/store';
import { useQueryClient } from '@tanstack/react-query';
import { nowISO } from '@/shared/lib/excel-date';
import { BEAM } from '@/shared/config/beam';
import { invalidateAfterMutation } from '@/shared/api/mutations';
import type { Prescription, FilterKey, SortKey, Settings } from '@/entities/prescription/model/types';

// ── Search ───────────────────────────────────────────────────────────────────

function matchesQuery(rx: Prescription, q: string): boolean {
  if (!q.trim()) return true;
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [
    rx.loyalty_name,
    rx.patient_national_id,
    rx.reference_number,
    rx.drug_name_sheet1,
    rx.drug_name_sheet2,
    rx.notes,
  ].filter(Boolean).join(' ').toLowerCase();
  return tokens.every(t => haystack.includes(t))
    || phoneMatchesQuery(rx.loyalty_phone, q);
}

// ── Filter ───────────────────────────────────────────────────────────────────

function applyFilter(rxs: Prescription[], filter: FilterKey): Prescription[] {
  switch (filter) {
    case 'urgent':    return rxs.filter(rx => rx.status === 'due_today' || rx.status === 'overdue');
    case 'pending':   return rxs.filter(rx => rx.status === 'pending');
    case 'skipped':   return rxs.filter(rx => rx.status === 'skipped');
    case 'vip':       return rxs.filter(rx => rx.is_vip);
    case 'scheduled': return rxs.filter(rx => rx.status === 'scheduled');
    case 'dispensed': return rxs.filter(rx => rx.status === 'dispensed');
    default:          return rxs;
  }
}

// ── Sort ────────────────────────────────────────────────────────────────────

function applySort(rxs: Prescription[], sort: SortKey, sortDir: 'asc' | 'desc'): Prescription[] {
  const m = sortDir === 'asc' ? 1 : -1;
  return [...rxs].sort((a, b) => {
    switch (sort) {
      case 'scheduled_date':
        return m * (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? '');
      case 'loyalty_name':
        return m * (a.loyalty_name ?? '').localeCompare(b.loyalty_name ?? '');
      case 'gross_value':
        return m * (a.gross_value - b.gross_value);
      case 'notified': {
        const aT = a.notified_at ?? '';
        const bT = b.notified_at ?? '';
        if (aT && !bT) return -m;
        if (!aT && bT) return m;
        return m * aT.localeCompare(bT);
      }
      case 'status_urgency':
      default:
        return m * (STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status]);
    }
  });
}

// ── Filter counts ────────────────────────────────────────────────────────────

const SECTION_HEADER = 'text-[10px] font-semibold uppercase tracking-wider text-text-muted';

function computeCounts(rxs: Prescription[]): Record<FilterKey, number> {
  return {
    all:       rxs.length,
    urgent:    rxs.filter(rx => rx.status === 'due_today' || rx.status === 'overdue').length,
    pending:   rxs.filter(rx => rx.status === 'pending').length,
    skipped:   rxs.filter(rx => rx.status === 'skipped').length,
    vip:       rxs.filter(rx => rx.is_vip).length,
    scheduled: rxs.filter(rx => rx.status === 'scheduled').length,
    dispensed: rxs.filter(rx => rx.status === 'dispensed').length,
  };
}

// ── Row ──────────────────────────────────────────────────────────────────────

interface RowProps {
  rx: Prescription;
  filter: FilterKey;
  settings?: Settings;
  onNoteChange: (id: number, note: string) => void;
  onInfoChange: (id: number, name: string | null, phone: string | null) => void;
  onReAction: (id: number, action: 'dispense' | 'due_today' | 'schedule', date?: string) => void;
  onNotify: (id: number, via: 'whatsapp' | 'call') => void;
}

const PrescriptionRow = memo(function PrescriptionRow({ rx, filter, settings, onNoteChange, onInfoChange, onReAction, onNotify }: RowProps) {
  const [expanded, setExpanded]   = useState(false);
  const [note, setNote]           = useState(rx.notes ?? '');
  const [showSched, setShowSched] = useState(false);
  const [schedDate, setSchedDate] = useState(tomorrowISO());
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName]   = useState(rx.loyalty_name ?? '');
  const [editPhone, setEditPhone] = useState(rx.loyalty_phone ?? '');
  const [showPhoneBarcode, setShowPhoneBarcode] = useState(false);
  const navigate = useNavigate();

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
          .then(() => invalidateAfterMutation(qc, 'notificationReset'));
      } else {
        timerRef.current = setTimeout(async () => {
          await updatePrescription(rxId, { notified_via: null, notified_at: null, updated_at: nowISO() });
          invalidateAfterMutation(qc, 'notificationReset');
        }, remaining);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rx.notified_via, rx.notified_at, durationDays, rx.id, qc]);

  // D1 fix: delegate to parent's undo-aware notify handler
  const handleNotify = useCallback((via: 'whatsapp' | 'call') => {
    if (!rx.id) return;
    onNotify(rx.id, via);
  }, [rx.id, onNotify]);

  const phone    = rx.loyalty_phone;
  const phoneLocal = phone ? localFormat(phone) : null;
  const waMsg    = buildWhatsAppMessage(rx, settings);
  const waLink   = whatsappLink(phone, waMsg);
  const callHref = callLink(phone);
  const drugName = rx.drug_name_sheet2 ?? rx.drug_name_sheet1;
  const beam     = rx.notified_via ? BEAM[rx.notified_via] : null;

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

      {/* ── Collapsed header ─────────────────────────────────── */}
      <div
        className="flex items-start gap-3 p-4 pb-3 cursor-pointer relative z-10"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          {/* Line 1: Name + VIP | StatusBadge */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-semibold text-text-primary truncate leading-tight">
                {rx.loyalty_name ?? 'Unknown Patient'}
              </span>
              {rx.is_vip && <VipBadge size="sm" />}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <StatusBadge status={rx.status} size="sm" />
            </div>
          </div>

          {/* Line 2: Drug name */}
          {drugName && (
            <p className="text-xs text-text-secondary m-0 mt-0.5 truncate leading-snug" title={drugName}>
              {drugName.length > 55 ? drugName.slice(0, 55) + '…' : drugName}
            </p>
          )}

          {/* Line 3: Scheduled date (only for scheduled cards) */}
          {rx.status === 'scheduled' && rx.scheduled_date && (
            <div className="flex items-center gap-1 mt-1 text-[11px] text-primary font-medium">
              <Calendar size={11} />
              {rx.scheduled_date}
            </div>
          )}

          {/* Line 4: Ref chip + Phone indicator */}
          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span className="text-[10px] text-text-muted font-mono bg-black/[0.03] px-1.5 py-0.5 rounded">
              #{rx.reference_number}
            </span>
            {phoneLocal && (
              <span className="text-[11px] text-success font-medium flex items-center gap-1 flex-shrink-0">
                <Phone size={10} /> {phoneLocal}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
          <ChevronDown
            size={16}
            className="text-text-muted transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </div>

      {/* ── Expanded detail ──────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">

              {/* ── Details section ─────────────────────── */}
              <div className="pt-3 border-t border-black/[0.04]">
                <div className="flex items-center justify-end mb-2">
                  {!isEditingInfo && (
                    <button
                      onClick={e => { e.stopPropagation(); setIsEditingInfo(true); }}
                      className="p-1 text-text-muted hover:text-primary bg-transparent border-none cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                      title="Edit Patient Info"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>

                {isEditingInfo ? (
                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
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
                        onClick={() => {
                          setEditName(rx.loyalty_name ?? '');
                          setEditPhone(rx.loyalty_phone ?? '');
                          setIsEditingInfo(false);
                        }}
                        className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-text-muted border-none cursor-pointer hover:shadow-neu-pressed transition-shadow"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          rx.id && onInfoChange(rx.id, editName || null, editPhone || null);
                          setIsEditingInfo(false);
                        }}
                        className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white shadow-neu-btn border-none cursor-pointer hover:shadow-neu-pressed transition-shadow"
                      >
                        Save Info
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">ID</span>
                      <span className="font-mono text-text-secondary text-[11px]">{rx.patient_national_id}</span>
                    </div>
                    {rx.gross_value > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted">Value</span>
                        <span className="font-bold text-text-primary">{rx.gross_value.toFixed(2)} SAR</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Phone Barcode section (toggleable) ──── */}
              {phone && (
                <div className="border-t border-black/[0.04] pt-3">
                  <button
                    onClick={e => { e.stopPropagation(); setShowPhoneBarcode(s => !s); }}
                    className="w-full flex items-center justify-between py-1.5 bg-transparent border-none cursor-pointer p-0"
                  >
                    <span className={SECTION_HEADER}>Phone Barcode</span>
                    <motion.span
                      animate={{ rotate: showPhoneBarcode ? 90 : 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ChevronRight size={14} className="text-text-muted" />
                    </motion.span>
                  </button>

                  <AnimatePresence>
                    {showPhoneBarcode && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-2 pb-1">
                          <div className="rounded-xl bg-white px-3 py-2.5 shadow-neu-sm">
                            <BarcodeVisual data={phoneLocal ?? ''} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ── Communication section ───────────────── */}
              {phone && (
                <div className="border-t border-black/[0.04] pt-3">
                  <div className="flex gap-2">
                    <a
                      href={callHref ?? undefined}
                      onClick={e => { e.stopPropagation(); if (callHref) handleNotify('call'); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-primary transition-all duration-150 hover:shadow-neu-btn-pressed"
                    >
                      <Phone size={13} /> Call Patient
                    </a>
                    <a
                      href={waLink ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => { e.stopPropagation(); if (waLink) handleNotify('whatsapp'); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-success transition-all duration-150 hover:shadow-neu-btn-pressed"
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  </div>
                </div>
              )}

              {/* ── Scan button ─────────────────────────── */}
              {rx.id && (
                <div className="border-t border-black/[0.04] pt-3">
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/scan?filter=${filter}&rx=${rx.id}`); }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-primary border-none cursor-pointer transition-all duration-150 hover:shadow-neu-btn-pressed"
                  >
                    <Scan size={13} /> Scan This Prescription
                  </button>
                </div>
              )}

              {/* ── Notes section ───────────────────────── */}
              <div className="border-t border-black/[0.04] pt-3">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onBlur={() => rx.id && onNoteChange(rx.id, note)}
                  rows={2}
                  placeholder="Add a note…"
                  onClick={e => e.stopPropagation()}
                  className="w-full rounded-xl p-2.5 text-xs resize-none outline-none bg-surface shadow-neu-inset text-text-primary placeholder:text-text-muted font-[inherit]"
                />
              </div>

              {/* ── Actions section ─────────────────────── */}
              {(['dispensed', 'scheduled', 'due_today', 'overdue'] as PrescriptionStatus[]).includes(rx.status) && (
                <div className="border-t border-black/[0.04] pt-3 space-y-2">
                  <div className="flex gap-2">
                    {rx.status !== 'dispensed' && (
                      <button
                        onClick={e => { e.stopPropagation(); rx.id && onReAction(rx.id, 'dispense'); }}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-success border-none cursor-pointer transition-all duration-150 hover:shadow-neu-btn-pressed"
                      >
                        <CheckCircle2 size={12} /> Dispense
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); rx.id && onReAction(rx.id, 'due_today'); }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-warning border-none cursor-pointer transition-all duration-150 hover:shadow-neu-btn-pressed"
                    >
                      <ArrowDown size={12} /> Due Today
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setShowSched(s => !s); }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface shadow-neu-btn text-primary border-none cursor-pointer transition-all duration-150 hover:shadow-neu-btn-pressed"
                    >
                      <Calendar size={12} /> Schedule
                    </button>
                  </div>

                  <AnimatePresence>
                    {showSched && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="flex gap-2 items-center pt-1">
                          <input
                            type="date"
                            value={schedDate}
                            min={todayISO()}
                            onClick={e => e.stopPropagation()}
                            onChange={e => setSchedDate(e.target.value)}
                            className="flex-1 bg-surface shadow-neu-inset rounded-xl px-3 py-2 text-xs text-text-primary border-none outline-none font-[inherit]"
                          />
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (rx.id) { onReAction(rx.id, 'schedule', schedDate); setShowSched(false); }
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-white border-none cursor-pointer shadow-neu-btn"
                          >
                            Confirm
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NeumorphicCard>
  );
});

// ── Main component ───────────────────────────────────────────────────────────

interface PrescriptionListProps {
  prescriptions: Prescription[];
  settings?: Settings;
  initialFilter?: FilterKey;
  onNoteChange: (id: number, note: string) => void;
  onInfoChange: (id: number, name: string | null, phone: string | null) => void;
  onReAction: (id: number, action: 'dispense' | 'due_today' | 'schedule', date?: string) => void;
  onNotify: (id: number, via: 'whatsapp' | 'call') => void;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'scheduled_date', label: 'Due Date'  },
  { key: 'gross_value',    label: 'Value'     },
  { key: 'notified',       label: 'Notified'  },
  { key: 'status_urgency', label: 'Urgency'   },
  { key: 'loyalty_name',   label: 'Name'      },
];

const PAGE_SIZE = 25;

export function PrescriptionList({ prescriptions, settings, initialFilter, onNoteChange, onInfoChange, onReAction, onNotify }: PrescriptionListProps) {
  const [query,  setQuery]  = useState('');
  const [filter, setFilter] = useState<FilterKey>(initialFilter ?? 'urgent');
  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);
  const [sort,      setSort]      = useState<SortKey>('scheduled_date');
  const [sortDir,   setSortDir]   = useState<'asc' | 'desc'>('asc');
  const [page,      setPage]      = useState(1);
  const navigate = useNavigate();

  const searched = useMemo(() => {
    return prescriptions.filter(rx => matchesQuery(rx, query));
  }, [prescriptions, query]);

  const counts = useMemo(() => computeCounts(prescriptions), [prescriptions]); // B6: always from full data, not search-filtered

  const visible = useMemo(() => {
    let result = searched;
    result = applyFilter(result, filter);
    result = applySort(result, sort, sortDir);
    return result;
  }, [searched, filter, sort, sortDir]);

  const paged = visible.slice(0, page * PAGE_SIZE);
  const hasMore = paged.length < visible.length;

  // Reset page on filter/query change
  const handleFilter = (f: FilterKey) => { setFilter(f); setPage(1); };
  const handleQuery  = (q: string)     => { setQuery(q);  setPage(1); };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-3 bg-surface rounded-neu-md shadow-neu-inset px-4 py-3">
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          value={query}
          onChange={e => handleQuery(e.target.value)}
          placeholder="Search name, ID, reference, drug, phone, notes…"
          className="bg-transparent border-none outline-none w-full text-sm text-text-primary
                     placeholder:text-text-muted font-[inherit]"
        />
        {query && (
          <button
            onClick={() => handleQuery('')}
            className="p-0.5 rounded-full bg-transparent border-none cursor-pointer"
          >
            <X size={14} className="text-text-muted" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <FilterBar active={filter} onChange={handleFilter} counts={counts} />

      {/* Sort + Scan */}
      <div className="flex items-center justify-between">
        {filter !== 'all' && filter !== 'dispensed' && visible.length > 0 && (
          <button
            onClick={() => navigate(`/scan?filter=${filter}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-[11px] font-bold border-[3px] border-primary shadow-neu-sm cursor-pointer transition-all duration-150"
          >
            <ScanLine size={13} />
            Scan
          </button>
        )}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none ml-auto">
          <SlidersHorizontal size={12} className="text-text-muted shrink-0" />
          {SORT_OPTIONS.map(o => {
            const isActive = sort === o.key;
            return (
              <button
                key={o.key}
                onClick={() => {
                  if (isActive) {
                    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSort(o.key);
                    setSortDir('desc');
                    setPage(1);
                  }
                }}
                className={[
                  'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold',
                  'border-2 cursor-pointer transition-all duration-150',
                  isActive
                    ? 'bg-primary text-white border-primary shadow-neu-btn'
                    : 'bg-surface border-black/[0.06] text-text-muted hover:text-text-secondary hover:border-black/10 shadow-neu-sm',
                ].join(' ')}
              >
                {o.label}
                {isActive && (
                  <span className="text-[10px] font-bold">
                    {sortDir === 'desc' ? '↓' : '↑'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {paged.length === 0 ? (
        <NeumorphicCard style={{ padding: '36px 24px', textAlign: 'center' }}>
          <p className="text-text-muted text-sm m-0">
            {query ? `No results for "${query}"` : 'No prescriptions in this view.'}
          </p>
        </NeumorphicCard>
      ) : (
        <div className="space-y-2">
          {paged.map(rx => (
            <PrescriptionRow
              key={rx.id}
              rx={rx}
              filter={filter}
              settings={settings}
              onNoteChange={onNoteChange}
              onInfoChange={onInfoChange}
              onReAction={onReAction}
              onNotify={onNotify}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <NeumorphicButton
          onClick={() => setPage(p => p + 1)}
          variant="ghost"
          className="w-full"
        >
          Load more ({visible.length - paged.length} remaining)
        </NeumorphicButton>
      )}
    </div>
  );
}

