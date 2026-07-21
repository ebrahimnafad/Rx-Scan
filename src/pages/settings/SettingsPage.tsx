// pages/settings/SettingsPage.tsx
import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Map, MapPin, Hash, Download, ChevronDown, RefreshCw, AlertTriangle, MessageCircle, Timer, RotateCcw, Trash2, GitBranch, Plus, X, Check } from 'lucide-react';
import { NeumorphicButton } from '@/shared/ui/NeumorphicButton';
import { CollapsibleSection } from '@/shared/ui/CollapsibleSection';
import { SyncForm } from '@/features/sync/ui/SyncForm';
import { ImportConfirmDialog } from '@/features/export/ui/ImportConfirmDialog';
import { getSettings, saveSettings, eraseAllData } from '@/app/db';
import { useExport } from '@/features/export/lib/useExport';
import { useBranch } from '@/app/providers/BranchProvider';
import { duration, ease } from '@/shared/config/motion-tokens';
import { NeumorphicInput } from '@/shared/ui/NeumorphicInput';
import { DEFAULT_WA_TEMPLATE } from '@/shared/lib/phone';
import type { Settings } from '@/entities/prescription/model/types';


function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 30_000,
  });
}

function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Record<string, string>>) => saveSettings(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

export default function SettingsPage() {
  const { data: settings = {} as Settings } = useSettings();
  const { mutate: save } = useSaveSettings();
  const { exportCsv, exportJson, importJson, importing } = useExport();
  const [helpOpen, setHelpOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUrlChange(key: 'sheet1_url' | 'sheet2_url', value: string) {
    save({ [key]: value });
  }

  function handleNameChange(key: 'sheet1_name' | 'sheet2_name', value: string) {
    save({ [key]: value });
  }

  function handleBranchField(key: string, value: string) {
    save({ [key]: value });
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setImportDialogOpen(true);
    }
    e.target.value = '';
  }

  function confirmImport() {
    if (pendingFile) {
      importJson(pendingFile);
      setPendingFile(null);
      setImportDialogOpen(false);
    }
  }

  async function handleEraseAll() {
    if (!window.confirm('This will permanently delete all prescriptions and settings. Continue?')) return;
    await eraseAllData();
    window.location.reload();
  }

  function handleExportFirst() {
    exportJson();
    // Keep pendingFile alive — dialog stays open so user can still confirm the import (B4 fix)
    // Do NOT null pendingFile or close the dialog here
  }

  // Sync status derivation
  const hasUrls = !!(settings.sheet1_url || settings.sheet2_url);
  const syncStatus = !hasUrls
    ? { color: 'bg-text-muted', label: 'Not configured' }
    : !settings.last_sync_at
      ? { color: 'bg-warning', label: 'Never synced' }
      : (Date.now() - Date.parse(settings.last_sync_at)) > 86_400_000
        ? { color: 'bg-warning', label: 'Stale' }
        : { color: 'bg-success', label: 'Connected' };

  return (
    <div className="space-y-5 pb-28">
      {/* ── Branches ────────────────────────────────────────────────────── */}
      <BranchesSection />

      {/* ── Sync ─────────────────────────────────────────────────────────── */}
      <CollapsibleSection
        icon={RefreshCw}
        title="Sheet Sync"
        color="text-primary"
        defaultOpen={true}
        badge={
          <span className="flex items-center gap-1 ml-1 text-xs font-normal text-text-secondary">
            <span className={`w-2 h-2 rounded-full ${syncStatus.color} inline-block`} />
            {syncStatus.label}
          </span>
        }
        summary={
          hasUrls
            ? `${syncStatus.label}${settings.last_sync_at ? ` · Last: ${new Date(settings.last_sync_at).toLocaleDateString()}` : ''}`
            : 'Not configured'
        }
      >
          <SyncForm
            sheet1Url={settings.sheet1_url ?? ''}
            sheet2Url={settings.sheet2_url ?? ''}
            sheet1Name={settings.sheet1_name}
            sheet2Name={settings.sheet2_name}
            lastSyncAt={settings.last_sync_at}
            lastCount1={settings.last_sync_count_sheet1}
            lastCount2={settings.last_sync_count_sheet2}
            onUrlChange={handleUrlChange}
            onNameChange={handleNameChange}
          />

          {/* URL help guide */}
          <div className="mt-4">
            <button
              onClick={() => setHelpOpen(v => !v)}
              className="flex items-center gap-1 text-xs text-text-muted bg-transparent border-none cursor-pointer p-0 hover:text-text-secondary transition-colors"
            >
              How do I get the CSV export URL?
              <motion.span
                animate={{ rotate: helpOpen ? 180 : 0 }}
                transition={{ duration: duration.fast / 1000 }}
              >
                <ChevronDown size={12} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {helpOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: duration.normal / 1000, ease: ease.standard }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 rounded-xl bg-surface shadow-neu-inset text-xs text-text-secondary space-y-1.5 leading-relaxed">
                    <p className="m-0">1. Open your Google Sheet</p>
                    <p className="m-0">2. File → Share → Publish to web</p>
                    <p className="m-0">3. Select the sheet tab → choose <strong>Comma-separated values (.csv)</strong></p>
                    <p className="m-0">4. Click Publish → copy the URL</p>
                    <p className="m-0 text-text-muted">The URL must contain <code>export?format=csv</code></p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CollapsibleSection>

      {/* ── Branch Settings + Notifications ──────────────────────────────── */}
      <CollapsibleSection
        icon={Building2}
        title="Branch Settings"
        color="text-warning"
        defaultOpen={false}
        badge={
          !settings.branch_number ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-[11px] font-medium text-amber-700 ml-1">
              <AlertTriangle size={10} />
              Setup incomplete
            </span>
          ) : undefined
        }
        summary={
          settings.branch_number
            ? `${settings.branch_number}${settings.branch_address ? ` · ${settings.branch_address.slice(0, 30)}${settings.branch_address.length > 30 ? '…' : ''}` : ''}`
            : 'Setup incomplete'
        }
      >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <Hash size={12} />
                Branch Number
              </label>
              <NeumorphicInput
                icon={Hash}
                placeholder="e.g. P0558"
                value={settings.branch_number ?? ''}
                onChange={e => handleBranchField('branch_number', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <MapPin size={12} />
                Branch Address
              </label>
              <NeumorphicInput
                icon={MapPin}
                placeholder="Full branch address"
                value={settings.branch_address ?? ''}
                onChange={e => handleBranchField('branch_address', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <Map size={12} />
                Google Maps Link
              </label>
              <NeumorphicInput
                icon={Map}
                placeholder="https://maps.google.com/..."
                value={settings.google_maps_link ?? ''}
                onChange={e => handleBranchField('google_maps_link', e.target.value)}
              />
            </div>

            {/* ── Notification Light (merged) ────────────── */}
            <div className="pt-3 border-t border-black/[0.04]">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                <Timer size={12} />
                Notification Auto-Reset
              </label>
              <p className="text-[11px] text-text-muted mb-2 m-0">
                After notifying a patient, the glow effect auto-resets after this many days. Leave empty for no auto-reset.
              </p>
              <NeumorphicInput
                type="number"
                placeholder="e.g. 7"
                value={settings.notified_light_duration_days !== undefined ? String(settings.notified_light_duration_days) : ''}
                onChange={e => save({ notified_light_duration_days: e.target.value })}
              />
            </div>
          </div>
        </CollapsibleSection>

      {/* ── WhatsApp Message Template ─────────────────────────────────────── */}
      <CollapsibleSection
        icon={MessageCircle}
        title="WhatsApp Template"
        color="text-success"
        defaultOpen={false}
        summary={
          (settings.wa_message_template || '') !== ''
            ? `${WA_CHIPS.length} variables · Custom message`
            : 'Default template'
        }
      >
        <WhatsAppTemplateCard settings={settings} save={save} />
      </CollapsibleSection>

      {/* ── Export / Import ───────────────────────────────────────────────── */}
      <CollapsibleSection
        icon={Download}
        title="Export / Import"
        color="text-text-secondary"
        defaultOpen={false}
        summary="Export & import data backups"
      >
          <div className="space-y-3">
            <NeumorphicButton onClick={exportCsv} variant="ghost" className="w-full">
              <Download size={15} />
              Export CSV Report
            </NeumorphicButton>
            <NeumorphicButton onClick={exportJson} variant="ghost" className="w-full">
              <Download size={15} />
              Export JSON Backup
            </NeumorphicButton>
            <NeumorphicButton
              variant="secondary"
              className="w-full"
              disabled={importing}
              onClick={handleImportClick}
            >
              <AlertTriangle size={15} />
              {importing ? 'Importing…' : 'Import JSON Backup'}
            </NeumorphicButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileSelected}
            />
            <p className="text-[11px] text-text-muted text-center m-0 leading-relaxed">
              CSV export: Reference#, Patient ID, Name, Phone, Status, Scheduled Date, Notes, VIP
            </p>
            <p className="text-[11px] text-text-muted text-center m-0 leading-relaxed">
              JSON backup: All prescriptions, settings, and sync metadata
            </p>
          </div>
        </CollapsibleSection>

      {/* ── Danger Zone ──────────────────────────────────────────────────── */}
      <CollapsibleSection
        icon={Trash2}
        title="Danger Zone"
        color="text-danger"
        defaultOpen={false}
        summary="Erase all local data"
      >
        <div className="space-y-3">
          <p className="text-xs text-text-muted m-0 leading-relaxed">
            Permanently delete all prescriptions, settings, and sync metadata from this device. This cannot be undone.
          </p>
          <NeumorphicButton
            variant="ghost"
            className="w-full text-danger hover:bg-danger/10"
            onClick={handleEraseAll}
          >
            <Trash2 size={15} />
            Erase All Local Data
          </NeumorphicButton>
        </div>
      </CollapsibleSection>

      {/* Import confirmation dialog */}
      <ImportConfirmDialog
        open={importDialogOpen}
        fileName={pendingFile?.name ?? ''}
        onConfirm={confirmImport}
        onExportFirst={handleExportFirst}
        onCancel={() => { setImportDialogOpen(false); setPendingFile(null); }}
      />
    </div>
  );
}

const WA_CHIPS = [
  { label: 'Patient Name', placeholder: '{{name}}' },
  { label: 'Reference #', placeholder: '{{reference}}' },
  { label: 'Branch', placeholder: '{{branch}}' },
  { label: 'Address', placeholder: '{{address}}' },
  { label: 'Maps Link', placeholder: '{{maps}}' },
];

const SAMPLE_VARS: Record<string, string> = {
  '{{name}}':      'Ahmed',
  '{{reference}}': 'ADR-0042',
  '{{branch}}':    'P0558',
  '{{address}}':   'King Fahd Road, Riyadh',
  '{{maps}}':      'https://maps.google.com/...',
};

function WhatsAppTemplateCard({
  settings,
  save,
}: {
  settings: Settings;
  save: (patch: Partial<Record<string, string>>) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [template, setTemplate] = useState(settings.wa_message_template ?? '');

  const preview = (() => {
    let msg = template || DEFAULT_WA_TEMPLATE;
    for (const [k, v] of Object.entries(SAMPLE_VARS)) msg = msg.replaceAll(k, v);
    return msg.replace(/\n{3,}/g, '\n\n');
  })();

  const insertChip = useCallback((placeholder: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = template.slice(0, start) + placeholder + template.slice(end);
    setTemplate(next);
    save({ wa_message_template: next });
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + placeholder.length;
    });
  }, [template, save]);

  const handleReset = () => {
    setTemplate('');
    save({ wa_message_template: '' });
  };

  return (
    <>
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
          Custom Message
        </label>
        <textarea
          ref={taRef}
          value={template}
          onChange={e => setTemplate(e.target.value)}
          onBlur={() => save({ wa_message_template: template })}
          rows={6}
          placeholder={DEFAULT_WA_TEMPLATE}
          className="w-full rounded-xl p-3 text-sm font-mono resize-y outline-none bg-surface shadow-neu-inset text-text-primary placeholder:text-text-muted leading-relaxed"
        />
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {WA_CHIPS.map(c => (
          <button
            key={c.placeholder}
            onClick={() => insertChip(c.placeholder)}
            className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium border-none cursor-pointer hover:bg-primary/20 transition-colors"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <p className="text-[11px] text-text-muted m-0 mb-1 uppercase tracking-wide">Preview</p>
        <div className="p-3 rounded-xl bg-surface shadow-neu-inset text-xs text-text-secondary whitespace-pre-wrap leading-relaxed font-mono">
          {preview}
        </div>
      </div>

      <button
        onClick={handleReset}
        className="flex items-center gap-1 mt-3 text-xs text-text-muted bg-transparent border-none cursor-pointer p-0 hover:text-text-secondary transition-colors"
      >
        <RotateCcw size={11} />
        Reset to default
      </button>
    </>
  );
}

function BranchesSection() {
  const { branches, activeBranch, switchBranch, createBranch, deleteBranch } = useBranch();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const branch = await createBranch(name);
    setNewName('');
    setCreating(false);
    await switchBranch(branch.id);
  }

  return (
    <CollapsibleSection
      icon={GitBranch}
      title="Branches"
      color="text-primary"
      defaultOpen={false}
      summary={`${branches.length} branch${branches.length !== 1 ? 'es' : ''} · ${activeBranch?.name ?? '—'}`}
    >
      <div className="space-y-2">
        {branches.map(b => (
          <div
            key={b.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-shadow ${
              b.id === activeBranch?.id
                ? 'bg-primary/10 shadow-neu-btn'
                : 'bg-surface shadow-neu'
            }`}
          >
            <Building2 size={16} className={b.id === activeBranch?.id ? 'text-primary' : 'text-text-muted'} />
            <span className={`flex-1 text-sm ${b.id === activeBranch?.id ? 'font-semibold text-primary' : 'text-text-primary'}`}>
              {b.name}
            </span>
            {b.id === activeBranch?.id && <Check size={14} className="text-primary" />}
            {b.id !== activeBranch?.id && (
              <button
                onClick={() => switchBranch(b.id)}
                className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium border-none cursor-pointer hover:bg-primary/20 transition-colors"
              >
                Switch
              </button>
            )}
            {b.id !== 'default' && b.id !== activeBranch?.id && (
              <button
                onClick={() => { if (window.confirm(`Delete branch "${b.name}"? This cannot be undone.`)) deleteBranch(b.id); }}
                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 border-none cursor-pointer bg-transparent transition-colors"
                title="Delete branch"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}

        {creating ? (
          <div className="flex gap-2 mt-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
              placeholder="Branch name"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-surface shadow-neu-inset border-none outline-none text-text-primary"
            />
            <button
              onClick={handleCreate}
              className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold border-none cursor-pointer shadow-neu-btn"
            >
              Add
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(''); }}
              className="p-2.5 rounded-xl bg-surface shadow-neu-btn text-text-muted border-none cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-2 mt-1 px-4 py-2.5 rounded-xl bg-transparent border-none cursor-pointer text-sm text-primary font-medium hover:bg-primary/5 transition-colors"
          >
            <Plus size={14} />
            New Branch
          </button>
        )}
      </div>
    </CollapsibleSection>
  );
}
