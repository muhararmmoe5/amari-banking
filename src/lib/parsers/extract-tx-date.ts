/**
 * Best-effort extraction of the *actual transaction date* (when the charge
 * happened) from a Chase CSV description string. Chase only gives us a single
 * "Posting Date" column, but the descriptions often embed the real effective
 * date in well-known formats.
 *
 * Returns null when no signal is present — caller can fall back to posting_date.
 *
 * Patterns we recognize (in order):
 *  - "EED:YYMMDD"   — Effective Entry Date on ACH transactions (e.g. "EED:251031")
 *  - "EED:YYYYMMDD" — same, 8-digit form
 *  - "DESC DATE:YYMMDD" — Chase ACH descriptor date
 *  - Trailing " MM/DD" or " MM/DD/YY" — common on card transactions, e.g.
 *    "DD *DOORDASH CHIPOTLE 855-431-0459 CA 05/08"
 *
 * For trailing MM/DD without a year, we infer year from the posting date,
 * snapping back by one year if the implied date would be in the future.
 */
export function extractTransactionDate(description: string, postingDate: string | null): string | null {
  if (!description) return null;

  // 1. EED:YYYYMMDD (8 digits, most precise — try first)
  const eed8 = description.match(/EED:\s*(\d{8})\b/i);
  if (eed8) {
    const s = eed8[1];
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    if (isValidYMD(y, m, d)) return `${y}-${m}-${d}`;
  }

  // 2. EED:YYMMDD (6 digits)
  const eed6 = description.match(/EED:\s*(\d{6})\b/i);
  if (eed6) {
    const s = eed6[1];
    const y = `20${s.slice(0, 2)}`;
    const m = s.slice(2, 4);
    const d = s.slice(4, 6);
    if (isValidYMD(y, m, d)) return `${y}-${m}-${d}`;
  }

  // 3. DESC DATE:YYMMDD
  const desc6 = description.match(/DESC\s*DATE:\s*(\d{6})\b/i);
  if (desc6) {
    const s = desc6[1];
    const y = `20${s.slice(0, 2)}`;
    const m = s.slice(2, 4);
    const d = s.slice(4, 6);
    if (isValidYMD(y, m, d)) return `${y}-${m}-${d}`;
  }

  // 4. Trailing " MM/DD/YY"
  const trailingYY = description.match(/\s(\d{1,2})\/(\d{1,2})\/(\d{2})\s*$/);
  if (trailingYY) {
    const [, m, d, yy] = trailingYY;
    const y = `20${yy}`;
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    if (isValidYMD(y, mm, dd)) return `${y}-${mm}-${dd}`;
  }

  // 5. Trailing " MM/DD" — infer year from posting date
  const trailing = description.match(/\s(\d{1,2})\/(\d{1,2})\s*$/);
  if (trailing && postingDate) {
    const [, m, d] = trailing;
    const mm = m.padStart(2, '0');
    const dd = d.padStart(2, '0');
    const postingY = parseInt(postingDate.slice(0, 4), 10);
    if (Number.isFinite(postingY)) {
      // Try current year first
      let y = String(postingY);
      if (isValidYMD(y, mm, dd)) {
        // If implied date is more than 60 days after posting, it's probably last year (rare year-boundary case).
        const implied = new Date(`${y}-${mm}-${dd}`);
        const posted = new Date(postingDate);
        const diffDays = (implied.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > 60) y = String(postingY - 1);
        if (isValidYMD(y, mm, dd)) return `${y}-${mm}-${dd}`;
      }
    }
  }

  return null;
}

function isValidYMD(y: string, m: string, d: string): boolean {
  const yy = parseInt(y, 10);
  const mm = parseInt(m, 10);
  const dd = parseInt(d, 10);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return false;
  if (yy < 2000 || yy > 2100) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  // Defensive — reject obviously bad dates like Feb 30
  const d2 = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (isNaN(d2.getTime())) return false;
  if (d2.getUTCMonth() + 1 !== mm) return false;
  return true;
}
