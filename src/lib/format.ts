export function fmtMoney(n: number, opts?: { sign?: boolean }): string {
  const sign = n < 0 ? '-' : opts?.sign ? '+' : '';
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateShort(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function flagSeverity(score: number): 'crit' | 'high' | 'med' | 'low' | 'ok' {
  if (score >= 80) return 'crit';
  if (score >= 60) return 'high';
  if (score >= 35) return 'med';
  if (score > 0) return 'low';
  return 'ok';
}

export function flagDot(score: number): string {
  const s = flagSeverity(score);
  return s === 'crit' ? '🔴' : s === 'high' ? '🟠' : s === 'med' ? '🟡' : s === 'low' ? '⚪' : '';
}
