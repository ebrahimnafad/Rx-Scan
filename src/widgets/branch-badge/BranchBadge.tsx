// widgets/branch-badge/BranchBadge.tsx
// Tappable badge showing active branch name. Opens a bottom sheet to switch branches.

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, ChevronDown, Check, Plus, X } from 'lucide-react';
import { useBranch } from '@/app/providers/BranchProvider';
import { duration, ease } from '@/shared/config/motion-tokens';

export function BranchBadge() {
  const { branches, activeBranch, switchBranch, createBranch, loading } = useBranch();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  if (loading || !activeBranch) return null;

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const branch = await createBranch(name);
    setNewName('');
    setCreating(false);
    await switchBranch(branch.id);
  }

  return (
    <>
      {/* Badge */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface shadow-neu-btn text-xs font-semibold text-text-primary border-none cursor-pointer hover:shadow-neu-pressed transition-shadow"
      >
        <Building2 size={13} className="text-primary" />
        {activeBranch.name}
        <ChevronDown size={11} className="text-text-muted" />
      </button>

      {/* Bottom sheet backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast / 1000 }}
            className="fixed inset-0 bg-black/30 z-[60]"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Bottom sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: duration.normal / 1000, ease: ease.standard }}
            className="fixed bottom-0 left-0 right-0 z-[60] bg-surface rounded-t-3xl shadow-neu-floating px-6 pt-4 pb-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-text-muted/30 mx-auto mb-4" />

            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3 m-0">Switch Branch</p>

            {/* Branch list */}
            <div className="space-y-2">
              {branches.map(b => (
                <button
                  key={b.id}
                  onClick={async () => { await switchBranch(b.id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-none cursor-pointer transition-shadow text-left ${
                    b.id === activeBranch.id
                      ? 'bg-primary/10 shadow-neu-btn text-primary font-semibold'
                      : 'bg-surface shadow-neu text-text-primary'
                  }`}
                >
                  <Building2 size={16} />
                  <span className="flex-1 text-sm">{b.name}</span>
                  {b.id === activeBranch.id && <Check size={14} className="text-primary" />}
                </button>
              ))}
            </div>

            {/* Create new branch */}
            {creating ? (
              <div className="mt-3 flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
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
                className="w-full flex items-center justify-center gap-2 mt-3 px-4 py-2.5 rounded-xl bg-transparent border-none cursor-pointer text-sm text-primary font-medium hover:bg-primary/5 transition-colors"
              >
                <Plus size={14} />
                New Branch
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
