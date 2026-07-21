// features/sync/ui/SyncForm.tsx
// URL inputs + URL validation + sync button + paste fallback + last sync status

import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Clipboard } from 'lucide-react';
import { NeumorphicCard } from '@/shared/ui/NeumorphicCard';
import { NeumorphicButton } from '@/shared/ui/NeumorphicButton';
import { useSync, validateSheetUrl } from '../lib/useSync';


interface SyncFormProps {
  sheet1Url: string;
  sheet2Url: string;
  sheet1Name?: string;
  sheet2Name?: string;
  lastSyncAt?: string;
  lastCount1?: number;
  lastCount2?: number;
  onUrlChange: (key: 'sheet1_url' | 'sheet2_url', value: string) => void;
  onNameChange: (key: 'sheet1_name' | 'sheet2_name', value: string) => void;
}

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(fn);
  latest.current = fn;
  return useCallback(
    ((...args: any[]) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), ms);
    }) as T,
    [],
  );
}

export function SyncForm({
  sheet1Url: propSheet1Url,
  sheet2Url: propSheet2Url,
  sheet1Name,
  sheet2Name,
  lastSyncAt,
  lastCount1,
  lastCount2,
  onUrlChange,
  onNameChange,
}: SyncFormProps) {
  const { loading, error, result, syncFromUrls, syncFromPaste } = useSync();
  const [showPaste, setShowPaste] = useState(false);
  const [paste1, setPaste1] = useState('');
  const [paste2, setPaste2] = useState('');
  const [urlError1, setUrlError1] = useState<string | null>(null);
  const [urlError2, setUrlError2] = useState<string | null>(null);

  // Local state for URL inputs — avoids stale-refetch flicker on fast typing
  const [localUrl1, setLocalUrl1] = useState(propSheet1Url);
  const [localUrl2, setLocalUrl2] = useState(propSheet2Url);
  const [editingName1, setEditingName1] = useState(false);
  const [editingName2, setEditingName2] = useState(false);
  const debounceUrl1 = useDebouncedCallback((v: string) => onUrlChange('sheet1_url', v), 400);
  const debounceUrl2 = useDebouncedCallback((v: string) => onUrlChange('sheet2_url', v), 400);

  // Sync local state when props change (e.g. initial load from IDB)
  useEffect(() => { setLocalUrl1(propSheet1Url); }, [propSheet1Url]);
  useEffect(() => { setLocalUrl2(propSheet2Url); }, [propSheet2Url]);

  function handleSync() {
    const e1 = localUrl1 ? validateSheetUrl(localUrl1) : null;
    const e2 = localUrl2 ? validateSheetUrl(localUrl2) : null;
    setUrlError1(e1);
    setUrlError2(e2);
    if (e1 || e2) return;
    if (!localUrl1 && !localUrl2) {
      setUrlError1('At least one sheet URL is required');
      return;
    }
    syncFromUrls(localUrl1 || undefined, localUrl2 || undefined);
  }

  function handlePasteSync() {
    if (!paste1 && !paste2) return;
    syncFromPaste(paste1 || undefined, paste2 || undefined);
  }

  const lastSyncDisplay = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString()
    : 'Never';

  return (
    <div className="space-y-4">
      {/* Last sync chip — promoted to top for scannability */}
      {(lastSyncAt || lastCount1 || lastCount2) && (
        <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <CheckCircle2 size={12} />
          Last sync: {lastSyncDisplay}
          {lastCount1 !== undefined && ` · ${lastCount1} rows S1`}
          {lastCount2 !== undefined && ` · ${lastCount2} rows S2`}
        </div>
      )}

      {/* Sheet 1 URL */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
          Invoices Sheet (Sheet 1)
        </label>
        <div className="flex items-center gap-3 bg-surface rounded-neu-md shadow-neu-inset px-3 py-2.5">
          {editingName1 ? (
            <input
              autoFocus
              type="text"
              placeholder="Type sheet name…"
              value={sheet1Name ?? ''}
              onChange={e => onNameChange('sheet1_name', e.target.value)}
              onBlur={() => { setEditingName1(false); if (!sheet1Name?.trim()) onNameChange('sheet1_name', ''); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-48 bg-transparent border-b border-primary/40 outline-none text-sm text-text-primary placeholder:text-text-muted shrink-0"
            />
          ) : sheet1Name ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-medium whitespace-nowrap shrink-0">
              {sheet1Name}
              <button
                onClick={() => onNameChange('sheet1_name', '')}
                className="p-0 ml-0.5 text-primary/60 hover:text-primary bg-transparent border-none cursor-pointer leading-none"
              >
                ×
              </button>
            </span>
          ) : (
            <button
              onClick={() => { if (localUrl1) setEditingName1(true); }}
              className="w-48 px-2 py-0.5 rounded-lg bg-transparent border border-dashed border-text-muted/30 text-text-muted text-xs shrink-0 cursor-pointer hover:border-primary/40 hover:text-primary transition-colors"
            >
              + Name
            </button>
          )}
          <input
            type="text"
            placeholder="https://docs.google.com/spreadsheets/...export?format=csv"
            value={localUrl1}
            onChange={e => {
              setLocalUrl1(e.target.value);
              debounceUrl1(e.target.value);
              setUrlError1(null);
            }}
            className="bg-transparent border-none outline-none w-full text-sm text-text-primary font-medium placeholder:text-text-muted"
          />
        </div>
        {urlError1 && <p className="text-[11px] text-danger mt-1 ml-1 m-0">{urlError1}</p>}
      </div>

      {/* Sheet 2 URL */}
      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
          VIP Sheet (Sheet 2)
        </label>
        <div className="flex items-center gap-3 bg-surface rounded-neu-md shadow-neu-inset px-3 py-2.5">
          {editingName2 ? (
            <input
              autoFocus
              type="text"
              placeholder="Type sheet name…"
              value={sheet2Name ?? ''}
              onChange={e => onNameChange('sheet2_name', e.target.value)}
              onBlur={() => { setEditingName2(false); if (!sheet2Name?.trim()) onNameChange('sheet2_name', ''); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className="w-48 bg-transparent border-b border-primary/40 outline-none text-sm text-text-primary placeholder:text-text-muted shrink-0"
            />
          ) : sheet2Name ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs font-medium whitespace-nowrap shrink-0">
              {sheet2Name}
              <button
                onClick={() => onNameChange('sheet2_name', '')}
                className="p-0 ml-0.5 text-primary/60 hover:text-primary bg-transparent border-none cursor-pointer leading-none"
              >
                ×
              </button>
            </span>
          ) : (
            <button
              onClick={() => { if (localUrl2) setEditingName2(true); }}
              className="w-48 px-2 py-0.5 rounded-lg bg-transparent border border-dashed border-text-muted/30 text-text-muted text-xs shrink-0 cursor-pointer hover:border-primary/40 hover:text-primary transition-colors"
            >
              + Name
            </button>
          )}
          <input
            type="text"
            placeholder="https://docs.google.com/spreadsheets/...export?format=csv"
            value={localUrl2}
            onChange={e => {
              setLocalUrl2(e.target.value);
              debounceUrl2(e.target.value);
              setUrlError2(null);
            }}
            className="bg-transparent border-none outline-none w-full text-sm text-text-primary font-medium placeholder:text-text-muted"
          />
        </div>
        {urlError2 && <p className="text-[11px] text-danger mt-1 ml-1 m-0">{urlError2}</p>}
        {sheet2Name === ' ' && (
          <input
            autoFocus
            type="text"
            placeholder="Type sheet name…"
            value=" "
            onChange={e => onNameChange('sheet2_name', e.target.value)}
            onBlur={() => { if (!sheet2Name.trim()) onNameChange('sheet2_name', ''); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="bg-transparent border-none outline-none w-full text-xs text-text-primary mt-1.5 ml-1 placeholder:text-text-muted"
          />
        )}
      </div>

      {/* Sync button */}
      <NeumorphicButton
        onClick={handleSync}
        variant="primary"
        size="lg"
        className="w-full"
        disabled={loading}
      >
        <RefreshCw size={16} className={loading ? 'animate-spin-smooth' : ''} />
        {loading ? 'Syncing…' : 'Sync Now'}
      </NeumorphicButton>

      {/* Error */}
      {error && (
        <NeumorphicCard style={{ padding: '12px 16px', border: '1px solid var(--color-danger)' }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-danger flex-shrink-0" />
            <p className="text-sm text-danger m-0">{error}</p>
          </div>
        </NeumorphicCard>
      )}

      {/* Success */}
      {result && (
        <NeumorphicCard style={{ padding: '12px 16px' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-success" />
            <p className="text-sm font-semibold text-success m-0">Sync complete</p>
          </div>
          <p className="text-xs text-text-muted m-0">
            {result.sheet1_count} invoices · {result.sheet2_count} VIP · {result.merged_count} merged
          </p>
        </NeumorphicCard>
      )}

      {/* Paste fallback */}
      <button
        onClick={() => setShowPaste(v => !v)}
        className="flex items-center gap-1 text-xs text-text-muted underline bg-transparent border-none cursor-pointer mx-auto"
      >
        <Clipboard size={12} />
        Paste CSV manually
        {showPaste ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {showPaste && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Sheet 1 CSV</label>
            <textarea
              value={paste1}
              onChange={e => setPaste1(e.target.value)}
              rows={4}
              placeholder="Paste CSV content here…"
              className="w-full rounded-xl p-3 text-xs font-mono resize-y outline-none bg-surface shadow-neu-inset text-text-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Sheet 2 CSV</label>
            <textarea
              value={paste2}
              onChange={e => setPaste2(e.target.value)}
              rows={4}
              placeholder="Paste CSV content here…"
              className="w-full rounded-xl p-3 text-xs font-mono resize-y outline-none bg-surface shadow-neu-inset text-text-primary"
            />
          </div>
          <NeumorphicButton onClick={handlePasteSync} variant="ghost" disabled={loading} className="w-full">
            Sync from Paste
          </NeumorphicButton>
        </div>
      )}
    </div>
  );
}
