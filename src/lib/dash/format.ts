export function $(n: number, p = 2): string {
  const sign = n < 0 ? '−' : '';
  return (
    sign +
    '$' +
    Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: p, maximumFractionDigits: p })
  );
}

export function $compact(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'K';
  return s + '$' + a.toFixed(0);
}

export function pct(n: number): string {
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';
}
