export function periodToDateRange(period: string | null | undefined): { from?: string; to?: string } {
  if (!period || period === 'ytd') {
    const now = new Date();
    const y = now.getFullYear();
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  if (/^\d{2}$/.test(period)) {
    const now = new Date();
    const y = now.getFullYear();
    const m = period;
    const last = new Date(y, parseInt(m, 10), 0).getDate();
    return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, '0')}` };
  }
  return {};
}
