import { fetchSheetCsv } from '@/shared/api/sheets';
import { parseSheet1 } from './parseSheet1';
import { parseSheet2 } from './parseSheet2';
import { fullOuterMerge, patientEnrichment } from '@/entities/prescription/lib/dedup';
import type { SyncProvider } from '../../SyncProvider';
import type { MergedPrescription } from '@/entities/prescription/model/types';

export class GoogleSheetsUrlAdapter implements SyncProvider {
  constructor(private sheet1Url?: string, private sheet2Url?: string) {}

  async fetch(): Promise<MergedPrescription[]> {
    const [csv1, csv2] = await Promise.all([
      this.sheet1Url ? fetchSheetCsv(this.sheet1Url) : Promise.resolve(''),
      this.sheet2Url ? fetchSheetCsv(this.sheet2Url) : Promise.resolve(''),
    ]);

    const s1 = csv1 ? parseSheet1(csv1) : [];
    const s2 = csv2 ? parseSheet2(csv2) : [];

    const merged = fullOuterMerge(s1, s2);
    return patientEnrichment(merged);
  }
}

export class GoogleSheetsPasteAdapter implements SyncProvider {
  constructor(private sheet1Csv?: string, private sheet2Csv?: string) {}

  async fetch(): Promise<MergedPrescription[]> {
    const s1 = this.sheet1Csv ? parseSheet1(this.sheet1Csv) : [];
    const s2 = this.sheet2Csv ? parseSheet2(this.sheet2Csv) : [];

    const merged = fullOuterMerge(s1, s2);
    return patientEnrichment(merged);
  }
}
