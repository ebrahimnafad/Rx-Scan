// adapters/idb/schema.ts
// IndexedDB schema definition — single source of truth for RxScan DB structure.
// Used by both production (idb) and test (memory) adapters.

import { type IDBPDatabase, type IDBPTransaction } from 'idb';
import type { Prescription, Settings } from '@/entities/prescription/model/types';

export interface RxScanDBSchema {
  prescriptions: {
    key: number;
    value: Prescription;
    indexes: {
      'by_dedup_key':            [string, string]; // [reference_number, patient_national_id]
      'by_status':               string;
      'by_queue_position':       number;
      'by_status_queue_position': [string, number]; // compound: status + queue_position
      'by_patient_national_id':  string;
      'by_scheduled_date':       string;
    };
  };
  settings: {
    key: string;
    value: { key: string; value: string };
  };
}

export const DB_NAME = 'rxscan-db';
export const DB_VERSION = 2;

export function createSchema(
  db: IDBPDatabase<RxScanDBSchema>,
  oldVersion: number,
  tx: IDBPTransaction<RxScanDBSchema, string[], 'versionchange'>,
): void {
  if (oldVersion < 1) {
    // v1: initial schema — create all stores and base indexes
    const store = db.createObjectStore('prescriptions', {
      keyPath: 'id',
      autoIncrement: true,
    });
    // Composite dedup constraint enforced via by_dedup_key index (ADR-0001)
    store.createIndex('by_dedup_key', ['reference_number', 'patient_national_id'], {
      unique: true,
    });
    store.createIndex('by_status', 'status');
    store.createIndex('by_queue_position', 'queue_position');
    store.createIndex('by_patient_national_id', 'patient_national_id');
    store.createIndex('by_scheduled_date', 'scheduled_date');
    store.createIndex('by_status_queue_position', ['status', 'queue_position']);

    // ── settings ─────────────────────────────────────────────
    db.createObjectStore('settings', { keyPath: 'key' });
  } else if (oldVersion < 2) {
    // v2: compound index for queue queries (ADR-0009)
    tx.objectStore('prescriptions').createIndex(
      'by_status_queue_position', ['status', 'queue_position'],
    );
  }
}

export type { Prescription, Settings };