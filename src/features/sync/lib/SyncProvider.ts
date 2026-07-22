import type { MergedPrescription } from '@/entities/prescription/model/types';

export interface SyncProvider {
  /**
   * Fetches, parses, and merges prescriptions from the underlying data source.
   * Returns a ready-to-upsert array of merged prescriptions.
   */
  fetch(): Promise<MergedPrescription[]>;
}
