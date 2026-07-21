// adapters/idb/base.ts
// Low-level IndexedDB primitives — thin wrapper over idb.
// Implements the adapter interface for production use.
// Supports multi-branch: each branch has its own rxscan-{id} database.

import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import { RxScanDBSchema, DB_VERSION, createSchema } from './schema';
import { getActiveBranchId, branchDbName } from './meta';

let currentBranchId: string | null = null;
let dbPromise: Promise<IDBPDatabase<RxScanDBSchema>> | null = null;

export async function getDb(): Promise<IDBPDatabase<RxScanDBSchema>> {
  if (!currentBranchId) {
    currentBranchId = await getActiveBranchId();
  }
  if (!dbPromise) {
    dbPromise = openDB<RxScanDBSchema>(branchDbName(currentBranchId), DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        createSchema(db, oldVersion, tx);
      },
    });
  }
  return dbPromise;
}

/** Force-close current connection. Next getDb() call opens the new branch's DB. */
export function resetDbConnection(newBranchId?: string): void {
  if (newBranchId) currentBranchId = newBranchId;
  dbPromise = null;
}

// ── Generic CRUD primitives ────────────────────────────────────

export async function get<T>(
  storeName: keyof RxScanDBSchema,
  key: IDBValidKey
): Promise<T | undefined> {
  const db = await getDb();
  return db.get(storeName, key);
}

export async function getAll<T>(
  storeName: keyof RxScanDBSchema
): Promise<T[]> {
  const db = await getDb();
  return db.getAll(storeName);
}

export async function getFromIndex<T>(
  storeName: keyof RxScanDBSchema,
  indexName: string,
  key: IDBValidKey
): Promise<T | undefined> {
  const db = await getDb();
  return db.getFromIndex(storeName, indexName, key);
}

export async function getAllFromIndex<T>(
  storeName: keyof RxScanDBSchema,
  indexName: string,
  key: IDBValidKey
): Promise<T[]> {
  const db = await getDb();
  return db.getAllFromIndex(storeName, indexName, key);
}

export async function put<T>(
  storeName: keyof RxScanDBSchema,
  value: T
): Promise<IDBValidKey> {
  const db = await getDb();
  return db.put(storeName, value);
}

export async function putTx<T>(
  tx: IDBPTransaction<RxScanDBSchema, string[], 'readwrite'>,
  _storeName: keyof RxScanDBSchema,
  value: T
): Promise<IDBValidKey> {
  return tx.objectStore('prescriptions').put(value);
}

export async function countFromIndex(
  storeName: keyof RxScanDBSchema,
  indexName: string,
  key: IDBValidKey
): Promise<number> {
  const db = await getDb();
  return db.countFromIndex(storeName, indexName, key);
}

export async function clear(
  storeName: keyof RxScanDBSchema
): Promise<void> {
  const db = await getDb();
  await db.clear(storeName);
}
