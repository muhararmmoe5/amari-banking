import type { EquityHolding } from '@/types/cap';

export function parseAmountToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const cents = parseInt(whole, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

export function fmtCents(cents: number): string {
  const n = Math.trunc(cents);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}$${whole}.${frac}`;
}

/**
 * Vested fraction of a holding as of `asOf` date.
 * Returns 0..1.
 *
 * Behavior:
 * - If the holding has no vesting fields set, it's fully vested (1.0).
 * - Before the cliff date, returns 0.
 * - After the cliff, vests linearly each month until total months elapsed.
 * - After the total period, returns 1.0.
 */
export function vestedFraction(h: EquityHolding, asOf: Date = new Date()): number {
  const start = h.vestingStart || h.grantDate;
  const totalMonths = h.vestingTotalMonths;
  if (!start || !totalMonths) return 1;
  const startDate = new Date(start);
  if (isNaN(startDate.getTime())) return 1;
  const monthsElapsed =
    (asOf.getFullYear() - startDate.getFullYear()) * 12 +
    (asOf.getMonth() - startDate.getMonth()) +
    (asOf.getDate() >= startDate.getDate() ? 0 : -1);
  const cliff = h.vestingCliffMonths || 0;
  if (monthsElapsed < cliff) return 0;
  if (monthsElapsed >= totalMonths) return 1;
  return Math.max(0, Math.min(1, monthsElapsed / totalMonths));
}

export function fmtPct(p: number, digits = 2): string {
  return `${p.toFixed(digits)}%`;
}
