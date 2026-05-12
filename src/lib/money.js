'use strict';

const MAX_CENTS = Number.MAX_SAFE_INTEGER;

function parseAmountToCents(input) {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const cents = parseInt(whole, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) return null;
  return cents;
}

function formatCents(cents) {
  const n = Math.trunc(cents);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

module.exports = { parseAmountToCents, formatCents };
