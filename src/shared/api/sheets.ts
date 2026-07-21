// shared/api/sheets.ts

/**
 * Normalises any Google Sheets URL to its CSV export form.
 * Accepts:
 *  - already-formed ?output=csv URLs (returned as-is)
 *  - standard /spreadsheets/d/<id>/... URLs
 *  - published /d/e/<id>/... URLs
 */
export function buildCsvUrl(sheetUrl: string): string {
  if (sheetUrl.includes('output=csv')) return sheetUrl;

  if (sheetUrl.includes('docs.google.com/spreadsheets')) {
    const match = sheetUrl.match(/\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
    if (match) {
      return `https://docs.google.com/spreadsheets/d/${match[1]}/pub?output=csv`;
    }
  }

  // Return as-is and let the fetch fail naturally with a meaningful HTTP error
  return sheetUrl;
}

/** Extracts the spreadsheet ID from any Google Sheets URL. Returns null if not found. */
export function extractSheetId(sheetUrl: string): string | null {
  const match = sheetUrl.match(/\/d\/(?:e\/)?([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/** Fetches a Google Sheets CSV and returns the raw text. Throws on non-OK responses. */
export async function fetchSheetCsv(sheetUrl: string): Promise<string> {
  const url = buildCsvUrl(sheetUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}
