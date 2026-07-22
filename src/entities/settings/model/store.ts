import { getDb } from '@/adapters/idb/base';
import type { IDBPTransaction } from 'idb';
import type { RxScanDBSchema } from '@/adapters/idb/schema';
import type { Settings } from '@/entities/prescription/model/types';

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const all = await db.getAll('settings');
  const obj: Record<string, string> = {};
  for (const row of all) obj[row.key] = row.value;
  return {
    sheet1_url:               obj['sheet1_url'],
    sheet2_url:               obj['sheet2_url'],
    sheet1_name:              obj['sheet1_name'],
    sheet2_name:              obj['sheet2_name'],
    branch_number:            obj['branch_number'],
    branch_address:           obj['branch_address'],
    google_maps_link:         obj['google_maps_link'],
    default_sort:             obj['default_sort'] as Settings['default_sort'],
    last_sync_at:             obj['last_sync_at'],
    last_sync_count_sheet1:   obj['last_sync_count_sheet1']
                                ? Number(obj['last_sync_count_sheet1']) : undefined,
    last_sync_count_sheet2:   obj['last_sync_count_sheet2']
                                ? Number(obj['last_sync_count_sheet2']) : undefined,
    notified_light_duration_days: obj['notified_light_duration_days']
                                ? Number(obj['notified_light_duration_days']) : undefined,
    wa_message_template:        obj['wa_message_template'],
  };
}

export async function saveSetting(key: string, value: string | number): Promise<void> {
  const db = await getDb();
  await db.put('settings', { key, value: String(value) });
}

export async function saveSettings(patch: Partial<Record<string, string | number>>): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('settings', 'readwrite');
  await Promise.all(
    Object.entries(patch).map(([k, v]) => tx.store.put({ key: k, value: String(v) }))
  );
  await tx.done;
}

export async function restoreSettingsIntoTx(
  tx: IDBPTransaction<RxScanDBSchema, any, 'readwrite'>,
  settingsPatch: Partial<Settings>
): Promise<void> {
  for (const [k, v] of Object.entries(settingsPatch)) {
    await tx.objectStore('settings').put({ key: k, value: String(v) });
  }
}
