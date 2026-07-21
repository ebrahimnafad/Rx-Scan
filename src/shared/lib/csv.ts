// shared/lib/csv.ts
// Shared CSV utilities used by sync parsers.

/**
 * Minimal RFC 4180-aware CSV line splitter.
 * Handles quoted fields containing commas and escaped double-quotes.
 */
export function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function fieldByHeader(headers: string[], row: string[], name: string): string | undefined {
  const idx = headers.indexOf(name);
  return idx >= 0 ? row[idx]?.trim() : undefined;
}
