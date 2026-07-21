// app/providers/BranchProvider.tsx
// Multi-branch context — manages branch list, active branch, and DB switching.

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { initMetaIfNeeded, getBranches, getActiveBranchId, setActiveBranchId, createBranch as dbCreateBranch, deleteBranch as dbDeleteBranch, renameBranch as dbRenameBranch } from '@/adapters/idb/meta';
import { resetDbConnection } from '@/adapters/idb/base';
import type { Branch } from '@/adapters/idb/meta';

interface BranchContextValue {
  branches: Branch[];
  activeBranch: Branch | null;
  loading: boolean;
  switchBranch: (id: string) => Promise<void>;
  createBranch: (name: string) => Promise<Branch>;
  deleteBranch: (id: string) => Promise<void>;
  renameBranch: (id: string, name: string) => Promise<void>;
}

const BranchCtx = createContext<BranchContextValue | null>(null);

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchCtx);
  if (!ctx) throw new Error('useBranch must be used within BranchProvider');
  return ctx;
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: init meta DB, load branches + active
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initMetaIfNeeded();
      const [all, activeId] = await Promise.all([getBranches(), getActiveBranchId()]);
      if (cancelled) return;
      setBranches(all);
      setActiveBranch(all.find(b => b.id === activeId) ?? all[0] ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const switchBranch = useCallback(async (id: string) => {
    await setActiveBranchId(id);
    resetDbConnection(id);
    const all = await getBranches();
    setBranches(all);
    setActiveBranch(all.find(b => b.id === id) ?? null);
    // Invalidate every query so all components refetch from the new branch's DB
    await qc.invalidateQueries();
  }, [qc]);

  const createBranch = useCallback(async (name: string) => {
    const branch = await dbCreateBranch(name);
    const all = await getBranches();
    setBranches(all);
    return branch;
  }, []);

  const deleteBranch = useCallback(async (id: string) => {
    await dbDeleteBranch(id);
    const all = await getBranches();
    setBranches(all);
    // If deleted the active branch, switch to first available
    if (activeBranch?.id === id && all.length > 0) {
      await switchBranch(all[0].id);
    }
  }, [activeBranch, switchBranch]);

  const renameBranch = useCallback(async (id: string, name: string) => {
    await dbRenameBranch(id, name);
    const all = await getBranches();
    setBranches(all);
    setActiveBranch(prev => prev?.id === id ? all.find(b => b.id === id) ?? prev : prev);
  }, []);

  return (
    <BranchCtx.Provider value={{ branches, activeBranch, loading, switchBranch, createBranch, deleteBranch, renameBranch }}>
      {children}
    </BranchCtx.Provider>
  );
}
