// test/harness.ts - Minimal test harness for pure logic functions
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fullOuterMerge, patientEnrichment } from '@/entities/prescription/lib/dedup';
import { surgicalUpsert } from '@/features/sync/lib/upsert';
import { assign, next, countByStatus, promoteScheduled } from '@/features/queue/lib/queue';
import { getDb, clearAllPrescriptions } from '@/app/db';
import { todayISO } from '@/shared/lib/excel-date';
import type { Sheet1Row, Sheet2Row, MergedPrescription, Prescription, PrescriptionStatus, QueueFilter } from '@/entities/prescription/model/types';

// ── Mock IndexedDB ──────────────────────────────────────────────
const mockDB = new Map<string, any>();
let autoId = 1;

// Index → field accessor mapping (mirrors adapters/idb/schema.ts)
const INDEX_FIELDS: Record<string, (rx: any) => any> = {
  by_dedup_key:             (rx) => [rx.reference_number, rx.patient_national_id],
  by_status:                (rx) => rx.status,
  by_queue_position:        (rx) => rx.queue_position,
  by_status_queue_position: (rx) => [rx.status, rx.queue_position],
  by_patient_national_id:   (rx) => rx.patient_national_id,
  by_scheduled_date:        (rx) => rx.scheduled_date,
};

function indexMatches(value: any, indexName: string, key: any): boolean {
  const accessor = INDEX_FIELDS[indexName];
  if (!accessor) return false;
  const indexKey = accessor(value);
  if (Array.isArray(key)) {
    const indexArr = Array.isArray(indexKey) ? indexKey : [indexKey];
    return key.every((k: any, i: number) => indexArr[i] === k);
  }
  return indexKey === key;
}

function recordsForStore(store: string) {
  return Array.from(mockDB.values()).filter(v => v.store === store);
}

function makeStore(storeName: string) {
  const putRecord = (val: any) => {
    const id = val.id || autoId++;
    const newVal = { ...val, id };
    // Remove old record if updating
    for (const [k, v] of mockDB) {
      if (v.store === storeName && v.value.id === id) {
        mockDB.delete(k);
        break;
      }
    }
    mockDB.set(`${storeName}:${id}`, { store: storeName, value: newVal });
    return Promise.resolve(id);
  };

  return {
    get: vi.fn((key: any) => {
      const record = recordsForStore(storeName).find(v => v.value.id === key);
      return Promise.resolve(record?.value);
    }),
    getAll: vi.fn(() => Promise.resolve(recordsForStore(storeName).map(v => v.value))),
    getAllFromIndex: vi.fn((_store: any, indexName: any, key: any) => {
      return Promise.resolve(
        recordsForStore(storeName)
          .filter(v => indexMatches(v.value, indexName, key))
          .map(v => v.value)
      );
    }),
    put: vi.fn(putRecord),
    count: vi.fn(() => Promise.resolve(recordsForStore(storeName).length)),
    countFromIndex: vi.fn((_store: any, indexName: any, key: any) => {
      return Promise.resolve(
        recordsForStore(storeName).filter(v => indexMatches(v.value, indexName, key)).length
      );
    }),
    clear: vi.fn(() => {
      for (const [k, v] of mockDB) if (v.store === storeName) mockDB.delete(k);
      return Promise.resolve();
    }),
    index: vi.fn((indexName: string) => ({
      get: vi.fn((key: any) => {
        const record = recordsForStore(storeName).find(v => indexMatches(v.value, indexName, key));
        return Promise.resolve(record?.value);
      }),
      getAll: vi.fn((key: any) => {
        return Promise.resolve(
          recordsForStore(storeName)
            .filter(v => indexMatches(v.value, indexName, key))
            .map(v => v.value)
        );
      }),
    })),
  };
}

function makeDB() {
  return {
    createObjectStore: vi.fn().mockReturnThis(),
    createIndex: vi.fn().mockReturnThis(),
    transaction: vi.fn((store: any, _mode: any) => ({
      store: makeStore(store),
      done: Promise.resolve(),
    })),
    get: vi.fn((store: any, key: any) => {
      const record = recordsForStore(store).find(v => v.value.id === key);
      return Promise.resolve(record?.value);
    }),
    getAll: vi.fn((store: any) => Promise.resolve(recordsForStore(store).map(v => v.value))),
    getFromIndex: vi.fn((store: any, indexName: any, key: any) => {
      const record = recordsForStore(store).find(v => indexMatches(v.value, indexName, key));
      return Promise.resolve(record?.value);
    }),
    put: vi.fn((store: any, val: any) => {
      const id = val.id || autoId++;
      const newVal = { ...val, id };
      for (const [k, v] of mockDB) {
        if (v.store === store && v.value.id === id) {
          mockDB.delete(k);
          break;
        }
      }
      mockDB.set(`${store}:${id}`, { store, value: newVal });
      return Promise.resolve(id);
    }),
    getAllFromIndex: vi.fn((store: any, indexName: any, key: any) => {
      return Promise.resolve(
        recordsForStore(store)
          .filter(v => indexMatches(v.value, indexName, key))
          .map(v => v.value)
      );
    }),
    countFromIndex: vi.fn((store: any, indexName: any, key: any) => {
      return Promise.resolve(
        recordsForStore(store).filter(v => indexMatches(v.value, indexName, key)).length
      );
    }),
    clear: vi.fn((store: any) => {
      for (const [k, v] of mockDB) if (v.store === store) mockDB.delete(k);
      return Promise.resolve();
    }),
  };
}

vi.mock('idb', () => ({
  openDB: vi.fn().mockImplementation(async (_name: any, _version: any, { upgrade }: any) => {
    const db = makeDB();
    upgrade(db, 2, null);
    return db;
  }),
}));

// Reset mock DB before each test
beforeEach(() => {
  mockDB.clear();
  autoId = 1;
});

// ── Helpers ──────────────────────────────────────────────────────

function seedRx(rx: Prescription) {
  mockDB.set(`prescriptions:${rx.id}`, { store: 'prescriptions', value: rx });
}

function getRx(id: number): Prescription | undefined {
  return mockDB.get(`prescriptions:${id}`)?.value;
}

function makeRx(overrides: Partial<Prescription> & { id: number }): Prescription {
  const now = new Date().toISOString();
  return {
    reference_number: 'REF', patient_national_id: 'NAT',
    loyalty_name: null, loyalty_phone: null,
    drug_name_sheet1: 'Drug', drug_name_sheet2: null,
    gross_value: 0, trx_date: null, is_vip: false,
    status: 'pending', scheduled_date: null, queue_position: null,
    notes: null, dispensed_at: null, actioned_at: null,
    notified_via: null, notified_at: null, created_at: now, updated_at: now,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('dedup.ts - fullOuterMerge', () => {
  it('merges matching Sheet1 + Sheet2 rows into VIP', () => {
    const s1: Sheet1Row[] = [{
      reference_number: 'REF1', patient_national_id: 'NAT1',
      drug_name_sheet1: 'DrugA', loyalty_name: 'John', loyalty_phone: '966500000001',
      trx_date: '2024-01-15', gross_value: 100,
    }];
    const s2: Sheet2Row[] = [{
      reference_number: 'REF1', patient_national_id: 'NAT1',
      drug_name_sheet2: 'DrugB', loyalty_phone: '966500000002',
    }];
    const merged = fullOuterMerge(s1, s2);
    expect(merged).toHaveLength(1);
    expect(merged[0].is_vip).toBe(true);
    expect(merged[0].drug_name_sheet1).toBe('DrugA');
    expect(merged[0].drug_name_sheet2).toBe('DrugB');
    expect(merged[0].loyalty_name).toBe('John');
    expect(merged[0].loyalty_phone).toBe('966500000001');
  });

  it('Sheet2-only becomes VIP with null Sheet1 fields', () => {
    const s1: Sheet1Row[] = [];
    const s2: Sheet2Row[] = [{
      reference_number: 'REF2', patient_national_id: 'NAT2',
      drug_name_sheet2: 'DrugC', loyalty_phone: '966500000003',
    }];
    const merged = fullOuterMerge(s1, s2);
    expect(merged).toHaveLength(1);
    expect(merged[0].is_vip).toBe(true);
    expect(merged[0].drug_name_sheet1).toBeNull();
    expect(merged[0].drug_name_sheet2).toBe('DrugC');
  });

  it('Sheet1-only stays non-VIP', () => {
    const s1: Sheet1Row[] = [{
      reference_number: 'REF3', patient_national_id: 'NAT3',
      drug_name_sheet1: 'DrugD', loyalty_name: 'Jane', loyalty_phone: '966500000004',
      trx_date: '2024-01-15', gross_value: 200,
    }];
    const s2: Sheet2Row[] = [];
    const merged = fullOuterMerge(s1, s2);
    expect(merged).toHaveLength(1);
    expect(merged[0].is_vip).toBe(false);
    expect(merged[0].drug_name_sheet2).toBeNull();
  });
});

describe('dedup.ts - patientEnrichment', () => {
  it('propagates name/phone across same patient', () => {
    const merged: MergedPrescription[] = [
      { reference_number: 'R1', patient_national_id: 'NAT1', loyalty_name: 'John', loyalty_phone: '966500000001', drug_name_sheet1: 'D1', drug_name_sheet2: null, gross_value: 100, trx_date: '2024-01-01', is_vip: false },
      { reference_number: 'R2', patient_national_id: 'NAT1', loyalty_name: null, loyalty_phone: null, drug_name_sheet1: 'D2', drug_name_sheet2: null, gross_value: 0, trx_date: null, is_vip: false },
    ];
    const enriched = patientEnrichment(merged);
    expect(enriched[0].loyalty_name).toBe('John');
    expect(enriched[1].loyalty_name).toBe('John');
    expect(enriched[1].loyalty_phone).toBe('966500000001');
  });

  it('first non-null wins for name/phone', () => {
    const merged: MergedPrescription[] = [
      { reference_number: 'R1', patient_national_id: 'NAT1', loyalty_name: 'First', loyalty_phone: '966500000001', drug_name_sheet1: 'D1', drug_name_sheet2: null, gross_value: 100, trx_date: '2024-01-01', is_vip: false },
      { reference_number: 'R2', patient_national_id: 'NAT1', loyalty_name: 'Second', loyalty_phone: '966500000002', drug_name_sheet1: 'D2', drug_name_sheet2: null, gross_value: 100, trx_date: '2024-01-01', is_vip: false },
    ];
    const enriched = patientEnrichment(merged);
    expect(enriched[0].loyalty_name).toBe('First');
    expect(enriched[1].loyalty_name).toBe('First');
  });
});

describe('queue.ts - assign', () => {
  it('assigns positions: VIP first, then trx_date desc', async () => {
    seedRx(makeRx({ id: 1, reference_number: 'R1', trx_date: '2024-01-10', is_vip: false, status: 'pending' }));
    seedRx(makeRx({ id: 2, reference_number: 'R2', trx_date: '2024-01-20', is_vip: true, status: 'pending' }));
    seedRx(makeRx({ id: 3, reference_number: 'R3', trx_date: '2024-01-15', is_vip: false, status: 'pending' }));

    await assign();

    expect(getRx(2)!.queue_position).toBe(0);  // VIP first
    expect(getRx(3)!.queue_position).toBe(1);  // then trx_date desc (Jan 15)
    expect(getRx(1)!.queue_position).toBe(2);  // then trx_date desc (Jan 10)
  });
});

describe('queue.ts - next', () => {
  it('default filter: returns first pending with queue_position >= 0', async () => {
    seedRx(makeRx({ id: 1, status: 'pending', queue_position: 1 }));
    seedRx(makeRx({ id: 2, status: 'pending', queue_position: 0 }));
    seedRx(makeRx({ id: 3, status: 'skipped', queue_position: 0 }));

    const result = await next({ type: 'default' });
    expect(result?.id).toBe(2); // queue_position 0 wins
  });

  it('default filter: falls back to skipped if no pending', async () => {
    seedRx(makeRx({ id: 1, status: 'skipped', queue_position: 0 }));

    const result = await next({ type: 'default' });
    expect(result?.id).toBe(1);
  });

  it('vip filter: returns first VIP by queue_position', async () => {
    seedRx(makeRx({ id: 1, status: 'pending', is_vip: true, queue_position: 2 }));
    seedRx(makeRx({ id: 2, status: 'overdue', is_vip: true, queue_position: 1 }));
    seedRx(makeRx({ id: 3, status: 'pending', is_vip: false, queue_position: 0 }));

    const result = await next({ type: 'vip' });
    expect(result?.id).toBe(2); // VIP with lowest queue_position
  });

  it('urgent filter: returns first due_today/overdue by trx_date asc', async () => {
    seedRx(makeRx({ id: 1, status: 'overdue', trx_date: '2024-01-20' }));
    seedRx(makeRx({ id: 2, status: 'due_today', trx_date: '2024-01-10' }));

    const result = await next({ type: 'urgent' });
    expect(result?.id).toBe(2); // earliest trx_date
  });

  it('scheduled filter: returns first by scheduled_date asc', async () => {
    seedRx(makeRx({ id: 1, status: 'scheduled', scheduled_date: '2024-01-20' }));
    seedRx(makeRx({ id: 2, status: 'scheduled', scheduled_date: '2024-01-10' }));

    const result = await next({ type: 'scheduled' });
    expect(result?.id).toBe(2); // earliest date
  });

  it('dispensed filter: returns most recent by dispensed_at desc', async () => {
    seedRx(makeRx({ id: 1, status: 'dispensed', dispensed_at: '2024-01-10T10:00:00' }));
    seedRx(makeRx({ id: 2, status: 'dispensed', dispensed_at: '2024-01-20T10:00:00' }));

    const result = await next({ type: 'dispensed' });
    expect(result?.id).toBe(2); // most recent
  });
});

describe('queue.ts - countByStatus', () => {
  it('counts prescriptions by status', async () => {
    seedRx(makeRx({ id: 1, status: 'pending' }));
    seedRx(makeRx({ id: 2, status: 'pending' }));
    seedRx(makeRx({ id: 3, status: 'dispensed' }));

    expect(await countByStatus('pending')).toBe(2);
    expect(await countByStatus('dispensed')).toBe(1);
    expect(await countByStatus('overdue')).toBe(0);
  });
});

describe('queue.ts - promoteScheduled', () => {
  it('promotes overdue and due_today, leaves future scheduled', async () => {
    const toLocalDate = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const today = todayISO();
    const yesterday = toLocalDate(new Date(Date.now() - 86400000));
    const tomorrow = toLocalDate(new Date(Date.now() + 86400000));

    seedRx(makeRx({ id: 1, status: 'scheduled', scheduled_date: yesterday }));
    seedRx(makeRx({ id: 2, status: 'scheduled', scheduled_date: today }));
    seedRx(makeRx({ id: 3, status: 'scheduled', scheduled_date: tomorrow }));

    await promoteScheduled();

    expect(getRx(1)!.status).toBe('overdue');
    expect(getRx(1)!.queue_position).toBeNull();
    expect(getRx(2)!.status).toBe('due_today');
    expect(getRx(2)!.queue_position).toBeNull();
    expect(getRx(3)!.status).toBe('scheduled'); // unchanged
  });
});

describe('upsert.ts - surgicalUpsert', () => {
  it('inserts new as pending', async () => {
    const merged: MergedPrescription[] = [{
      reference_number: 'NEW1', patient_national_id: 'NAT1',
      loyalty_name: 'New', loyalty_phone: '966500000001',
      drug_name_sheet1: 'Drug', drug_name_sheet2: null,
      gross_value: 100, trx_date: '2024-01-01', is_vip: false,
    }];
    await surgicalUpsert(merged);
    const all = recordsForStore('prescriptions');
    const inserted = all.find(v => v.value.reference_number === 'NEW1');
    expect(inserted).toBeDefined();
    expect(inserted!.value.status).toBe('pending');
    expect(inserted!.value.queue_position).toBeNull();
  });

  it('full-replaces pending but preserves action fields', async () => {
    seedRx(makeRx({
      id: 1, reference_number: 'EXIST', patient_national_id: 'NAT1',
      status: 'pending', queue_position: 5, notes: 'my note',
    }));

    const merged: MergedPrescription[] = [{
      reference_number: 'EXIST', patient_national_id: 'NAT1',
      loyalty_name: 'New', loyalty_phone: '966500000002',
      drug_name_sheet1: 'NewDrug', drug_name_sheet2: 'Sheet2Drug',
      gross_value: 200, trx_date: '2024-01-02', is_vip: true,
    }];
    await surgicalUpsert(merged);

    const updated = getRx(1)!;
    expect(updated.loyalty_name).toBe('New');
    expect(updated.drug_name_sheet1).toBe('NewDrug');
    expect(updated.drug_name_sheet2).toBe('Sheet2Drug');
    expect(updated.is_vip).toBe(true);
    // Preserved
    expect(updated.status).toBe('pending');
    expect(updated.queue_position).toBe(5);
    expect(updated.notes).toBe('my note');
  });

  it('enriches acted-on (dispensed) only allowed fields', async () => {
    const now = new Date().toISOString();
    seedRx(makeRx({
      id: 2, reference_number: 'DISP', patient_national_id: 'NAT2',
      status: 'dispensed', loyalty_name: 'Old', loyalty_phone: '966500000001',
      drug_name_sheet1: 'OldDrug', dispensed_at: now, actioned_at: now,
    }));

    const merged: MergedPrescription[] = [{
      reference_number: 'DISP', patient_national_id: 'NAT2',
      loyalty_name: 'NewName', loyalty_phone: '966500000002',
      drug_name_sheet1: 'NewDrug', drug_name_sheet2: 'Sheet2Drug',
      gross_value: 200, trx_date: '2024-01-02', is_vip: true,
    }];
    await surgicalUpsert(merged);

    const updated = getRx(2)!;
    // Should update
    expect(updated.is_vip).toBe(true);
    expect(updated.drug_name_sheet2).toBe('Sheet2Drug');
    // existing wins for loyalty fields
    expect(updated.loyalty_name).toBe('Old');
    expect(updated.loyalty_phone).toBe('966500000001');
    // Should NOT change
    expect(updated.status).toBe('dispensed');
    expect(updated.drug_name_sheet1).toBe('OldDrug');
    expect(updated.dispensed_at).toBe(now);
  });
});

describe('Queue consistency: assign vs reorder', () => {
  it('due_today and overdue should have queue_position=null in assign', async () => {
    seedRx(makeRx({ id: 1, status: 'pending', trx_date: '2024-01-10' }));
    seedRx(makeRx({ id: 2, status: 'due_today', trx_date: '2024-01-20' }));
    seedRx(makeRx({ id: 3, status: 'overdue', trx_date: '2024-01-15' }));

    await assign();

    expect(getRx(1)!.queue_position).toBe(0);
    expect(getRx(2)!.queue_position).toBeNull(); // due_today excluded
    expect(getRx(3)!.queue_position).toBeNull(); // overdue excluded
  });
});

describe('useOverdueScheduler logic', () => {
  it('scheduled_date < today -> overdue, queue_position=null', () => {
    const today = '2024-01-20';
    const scheduled = [
      { id: 1, scheduled_date: '2024-01-19', status: 'scheduled' },
      { id: 2, scheduled_date: '2024-01-20', status: 'scheduled' },
      { id: 3, scheduled_date: '2024-01-21', status: 'scheduled' },
    ];
    const results = scheduled.map(rx => {
      if (rx.scheduled_date! < today) return { ...rx, status: 'overdue', queue_position: null };
      if (rx.scheduled_date! === today) return { ...rx, status: 'due_today', queue_position: null };
      return rx;
    });
    expect(results[0].status).toBe('overdue');
    expect(results[0].queue_position).toBeNull();
    expect(results[1].status).toBe('due_today');
    expect(results[1].queue_position).toBeNull();
    expect(results[2].status).toBe('scheduled');
  });
});
