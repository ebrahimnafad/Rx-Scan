// adapters/idb/meta.ts
// Meta-database for branch registry + active branch tracking.
// Each branch gets its own rxscan-{id} database; this DB just tracks which one is active.

import { openDB, type IDBPDatabase } from 'idb';

/* ── Schema ─────────────────────────────────────────────────────── */

interface MetaDBSchema {
  branches: {
    key: string;
    value: { id: string; name: string; created_at: string };
  };
  config: {
    key: string;
    value: { key: string; value: string };
  };
}

export interface Branch {
  id: string;
  name: string;
  created_at: string;
}

const META_DB_NAME = 'rxscan-meta';
const META_DB_VERSION = 1;
const LEGACY_DB_NAME = 'rxscan-db';
const ACTIVE_BRANCH_KEY = 'active_branch_id';

let metaDb: Promise<IDBPDatabase<MetaDBSchema>> | null = null;

async function getMetaDb(): Promise<IDBPDatabase<MetaDBSchema>> {
  if (!metaDb) {
    metaDb = openDB<MetaDBSchema>(META_DB_NAME, META_DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('branches', { keyPath: 'id' });
        db.createObjectStore('config', { keyPath: 'key' });
      },
    });
  }
  return metaDb;
}

/* ── Public API ─────────────────────────────────────────────────── */

export function branchDbName(branchId: string): string {
  return branchId === 'default' ? LEGACY_DB_NAME : `rxscan-${branchId}`;
}

export async function getBranches(): Promise<Branch[]> {
  const db = await getMetaDb();
  return db.getAll('branches');
}

export async function getActiveBranchId(): Promise<string> {
  const db = await getMetaDb();
  const row = await db.get('config', ACTIVE_BRANCH_KEY);
  return row?.value ?? 'default';
}

export async function setActiveBranchId(id: string): Promise<void> {
  const db = await getMetaDb();
  await db.put('config', { key: ACTIVE_BRANCH_KEY, value: id });
}

export async function createBranch(name: string): Promise<Branch> {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || `branch-${Date.now()}`;
  const branch: Branch = { id, name, created_at: new Date().toISOString() };
  const db = await getMetaDb();
  await db.put('branches', branch);
  return branch;
}

export async function deleteBranch(id: string): Promise<void> {
  if (id === 'default') throw new Error('Cannot delete the Default branch');
  const db = await getMetaDb();
  await db.delete('branches', id);
  // Delete the branch's IndexedDB
  indexedDB.deleteDatabase(branchDbName(id));
}

export async function renameBranch(id: string, name: string): Promise<void> {
  const db = await getMetaDb();
  const existing = await db.get('branches', id);
  if (existing) {
    await db.put('branches', { ...existing, name });
  }
}

/* ── First-boot migration ───────────────────────────────────────── */

let migrated = false;

export async function initMetaIfNeeded(): Promise<void> {
  if (migrated) return;
  migrated = true;

  const db = await getMetaDb();
  const existing = await db.get('config', ACTIVE_BRANCH_KEY);
  if (existing) return; // meta DB already initialized

  // First boot — create Default branch
  const defaultBranch: Branch = {
    id: 'default',
    name: 'Default',
    created_at: new Date().toISOString(),
  };
  await db.put('branches', defaultBranch);
  await db.put('config', { key: ACTIVE_BRANCH_KEY, value: 'default' });

  // Legacy DB (rxscan-db) is already used by the Default branch via branchDbName('default')
  // No data migration needed — 'default' maps to 'rxscan-db'
}
