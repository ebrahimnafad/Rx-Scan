import { getDb } from '@/adapters/idb/base';
import { clear as baseClear } from '@/adapters/idb/base';
import { restorePrescriptionsIntoTx } from '@/entities/prescription/model/store';
import { restoreSettingsIntoTx } from '@/entities/settings/model/store';
import type { Prescription, Settings } from '@/entities/prescription/model/types';
import { nowISO } from '@/shared/lib/excel-date';

export async function eraseAllData(): Promise<void> {
  await Promise.all([baseClear('prescriptions'), baseClear('settings')]);
}

export async function restoreBackup(prescriptions: Prescription[], settingsPatch: Partial<Settings>): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['prescriptions', 'settings'], 'readwrite');
  const now = nowISO();

  await restorePrescriptionsIntoTx(tx, prescriptions, now);
  await restoreSettingsIntoTx(tx, settingsPatch);

  await tx.done;
}
