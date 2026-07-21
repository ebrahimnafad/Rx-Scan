// shared/lib/phone.ts

/** Clean sentinel phone values to null. */
export function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s === '' || s === '12345') return null;
  return s;
}

/**
 * Normalize any phone format to "966XXXXXXXXX" (12-digit stored format).
 * Handles:
 *   - 966509077243 (numeric from Invoices sheet)
 *   - "0505626728"  (local format from VIP sheet)
 *   - "966505626728" (already normalized)
 */
export function normalizePhone(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/\D/g, ''); // digits only
  if (!s || s === '12345') return null;
  if (s.startsWith('966') && s.length === 12) return s;
  if (s.startsWith('0') && s.length === 10) return '966' + s.slice(1);
  if (s.length === 9) return '966' + s;
  return null; // unrecognized format
}

/** WhatsApp deep link: https://wa.me/966XXXXXXXXX */
export function whatsappLink(phone: string | null, message?: string): string | null {
  if (!phone) return null;
  const base = `https://wa.me/${phone}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Local call format: tel:0XXXXXXXXX */
export function callLink(phone: string | null): string | null {
  if (!phone) return null;
  const local = '0' + phone.slice(3); // strip 966, prepend 0
  return `tel:${local}`;
}

/** Local display format: 0XXXXXXXXX */
export function localFormat(phone: string | null): string | null {
  if (!phone) return null;
  return '0' + phone.slice(3);
}

/**
 * For search: strips the 966 prefix so users can type local format.
 * Input "05XXXXXXXX" → match against last 9 digits of stored phone.
 */
export function phoneMatchesQuery(phone: string | null, query: string): boolean {
  if (!phone || !query || phone.length < 10) return false;
  const q = query.replace(/^966/, '0').replace(/\D/g, '');
  if (!q) return false;
  const local = '0' + phone.slice(3);
  return local.includes(q);
}

export const DEFAULT_WA_TEMPLATE = [
  'Hello {{name}},',
  'Your prescription is ready for pickup.',
  'Reference #: {{reference}}',
  'Branch: {{branch}}',
  'Address: {{address}}',
  'Location: {{maps}}',
].join('\n');

/** Build a WhatsApp pickup-notification message. */
export function buildWhatsAppMessage(
  rx: { loyalty_name?: string | null; reference_number: string },
  settings?: { branch_number?: string; branch_address?: string; google_maps_link?: string; wa_message_template?: string },
): string {
  const name    = rx.loyalty_name ?? 'Dear Customer';
  const ref     = rx.reference_number;
  const branch  = settings?.branch_number ?? '';
  const address = settings?.branch_address ?? '';
  const maps    = settings?.google_maps_link ?? '';

  const vars: Record<string, string> = {
    '{{name}}':      name,
    '{{reference}}': ref,
    '{{branch}}':    branch,
    '{{address}}':   address,
    '{{maps}}':      maps,
  };

  const template = settings?.wa_message_template || DEFAULT_WA_TEMPLATE;
  let msg = template;
  for (const [key, val] of Object.entries(vars)) {
    msg = msg.replaceAll(key, val);
  }
  // collapse consecutive blank lines (from empty variable substitutions) into one
  return msg.replace(/\n{3,}/g, '\n\n');
}
