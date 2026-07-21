// shared/lib/excel-date.ts

/**
 * Convert an Excel date serial number to an ISO date string (YYYY-MM-DD).
 *
 * Excel stores dates as days since 1900-01-01 (with a leap-year bug that
 * treats 1900 as a leap year, so the epoch offset is 25569 days to Unix epoch).
 *
 * Example: 46117 → "2026-04-26"
 */
export function excelSerialToISO(serial: number | string | null | undefined): string | null {
  if (serial === null || serial === undefined || serial === '') return null;
  const n = Number(serial);
  if (isNaN(n) || n <= 0) return null;
  // Convert to milliseconds from Unix epoch
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Today's ISO date string (YYYY-MM-DD) in local time. */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Tomorrow's ISO date string (YYYY-MM-DD) in local time. */
export function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO timestamp string for now. */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Compare two ISO date strings. Returns negative / 0 / positive. */
export function compareISO(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}
