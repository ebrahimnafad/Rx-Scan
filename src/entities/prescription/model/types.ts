// entities/prescription/model/types.ts

export type PrescriptionStatus =
  | 'pending'
  | 'skipped'
  | 'dispensed'
  | 'scheduled'
  | 'due_today'
  | 'overdue';

export interface Prescription {
  id?: number;
  // Dedup key (ADR-0001)
  reference_number: string;
  patient_national_id: string;
  // Patient enrichment (ADR-0006)
  loyalty_name: string | null;
  loyalty_phone: string | null; // stored as "966XXXXXXXXX"
  // Drug name from both sheets
  drug_name_sheet1: string | null;
  drug_name_sheet2: string | null;
  // Financial / temporal
  gross_value: number; // SAR, default 0
  trx_date: string | null; // ISO date "YYYY-MM-DD"
  // Source flag (ADR-0007)
  is_vip: boolean;
  // Status lifecycle
  status: PrescriptionStatus;
  scheduled_date: string | null; // ISO date
  queue_position: number | null;
  notes: string | null;
  // Action timestamps
  dispensed_at: string | null;
  actioned_at: string | null; // set ONCE — never overwritten (ADR-0002/0008)
  // Notification tracking
  notified_via: 'whatsapp' | 'call' | null;
  notified_at: string | null;
  // Row metadata
  created_at: string;
  updated_at: string;
}

export interface Settings {
  sheet1_url?: string;
  sheet2_url?: string;
  sheet1_name?: string;
  sheet2_name?: string;
  branch_number?: string;
  branch_address?: string;
  google_maps_link?: string;
  default_sort?: SortKey;
  last_sync_at?: string;
  last_sync_count_sheet1?: number;
  last_sync_count_sheet2?: number;
  notified_light_duration_days?: number;
  wa_message_template?: string;
}

export type SortKey =
  | 'scheduled_date'
  | 'loyalty_name'
  | 'status_urgency'
  | 'gross_value'
  | 'notified';

export type FilterKey =
  | 'all'
  | 'urgent'       // due_today + overdue
  | 'pending'
  | 'skipped'
  | 'vip'
  | 'dispensed'
  | 'scheduled';

// --- Sync pipeline types ---

export interface Sheet1Row {
  reference_number: string;
  patient_national_id: string;
  drug_name_sheet1: string | null;
  loyalty_name: string | null;
  loyalty_phone: string | null; // normalized to "966XXXXXXXXX"
  trx_date: string | null;      // ISO date
  gross_value: number;
}

export interface Sheet2Row {
  reference_number: string;
  patient_national_id: string;
  drug_name_sheet2: string | null;
  loyalty_phone: string | null; // normalized to "966XXXXXXXXX"
}

export interface MergedPrescription {
  reference_number: string;
  patient_national_id: string;
  loyalty_name: string | null;
  loyalty_phone: string | null;
  drug_name_sheet1: string | null;
  drug_name_sheet2: string | null;
  gross_value: number;
  trx_date: string | null;
  is_vip: boolean;
}

export interface SyncResult {
  sheet1_count: number;
  sheet2_count: number;
  merged_count: number;
  last_sync_at: string;
}
