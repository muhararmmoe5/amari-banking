import crypto from 'crypto';

/** Normalize a merchant string per CLAUDE.md spec — used as part of the
 *  transaction fingerprint so CSV-imported rows match Plaid-reported rows
 *  even when bank descriptions differ in punctuation, prefixes, and case. */
export function normalizeMerchant(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(pos|purchase|debit|ach|web|tst|sq|tst\*|pp)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

/** sha256(amount|date|normalize_merchant(merchant_raw)) — stable across
 *  CSV and Plaid sources for the same real-world transaction. */
export function computeFingerprint(amount: number, date: string, merchantRaw: string): string {
  const norm = normalizeMerchant(merchantRaw);
  return crypto
    .createHash('sha256')
    .update(`${amount.toFixed(2)}|${date}|${norm}`)
    .digest('hex');
}
