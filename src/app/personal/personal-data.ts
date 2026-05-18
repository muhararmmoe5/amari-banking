import 'server-only';
import { getDb } from '@/lib/db';
import { PERSONAL_CATEGORIES } from '@/constants/categories';

export interface PersonalSummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  txCount: number;
  byCategory: Array<{ category: string; total: number; count: number; color: string }>;
  byPerson: Array<{ personId: string | null; name: string; total: number; count: number }>;
  byMonth: Array<{ month: string; income: number; expenses: number; net: number }>;
}

const PERSONAL_CAT_COLORS: Record<string, string> = {
  HOUSING: '#c98a7a',
  FAMILY: '#b18ac9',
  FOOD: '#c9a87a',
  TRANSPORT: '#6b8aa8',
  HEALTH: '#7a8c6b',
  ENTERTAINMENT: '#c9b8a8',
  SAVINGS: '#88724a',
  OWNER: '#a78bfa',
};

const subToBucket: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [k, b] of Object.entries(PERSONAL_CATEGORIES)) {
    for (const sub of b.subs) m[sub] = k;
  }
  return m;
})();

export function personalSummary(dateFrom?: string, dateTo?: string): PersonalSummary {
  const db = getDb();
  const where: string[] = ["COALESCE(confirmed_entity, entity_tag) = 'PERSONAL'", 'is_internal = 0'];
  const params: any[] = [];
  if (dateFrom) { where.push('posting_date >= ?'); params.push(dateFrom); }
  if (dateTo) { where.push('posting_date <= ?'); params.push(dateTo); }
  const w = `WHERE ${where.join(' AND ')}`;

  const agg = db.prepare(`
    SELECT
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses,
      COUNT(*) as count
    FROM transactions ${w}
  `).get(...params) as any;

  // Category rollup — uses subCategory2 fallbacks to sub_category_1 and category
  const catRows = db.prepare(`
    SELECT COALESCE(sub_category_2, sub_category_1, category) as cat, SUM(ABS(amount)) as total, COUNT(*) as count
    FROM transactions ${w} AND amount < 0
    GROUP BY cat
    ORDER BY total DESC
    LIMIT 12
  `).all(...params) as any[];

  // Person rollup — for things like family support, who paid whom
  const personRows = db.prepare(`
    SELECT
      t.source_person_id as person_id,
      p.name as name,
      SUM(ABS(t.amount)) as total,
      COUNT(*) as count
    FROM transactions t
    LEFT JOIN people p ON p.id = t.source_person_id
    ${w} AND t.amount < 0 AND t.source_person_id IS NOT NULL
    GROUP BY t.source_person_id
    ORDER BY total DESC
    LIMIT 10
  `).all(...params) as any[];

  // Monthly breakdown for the line chart
  const monthRows = db.prepare(`
    SELECT
      substr(posting_date, 1, 7) as month,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses
    FROM transactions ${w}
    GROUP BY month
    ORDER BY month ASC
  `).all(...params) as any[];

  return {
    totalIncome: agg.income || 0,
    totalExpenses: agg.expenses || 0,
    net: (agg.income || 0) - (agg.expenses || 0),
    txCount: agg.count || 0,
    byCategory: catRows.map((r) => ({
      category: r.cat || 'Uncategorized',
      total: r.total,
      count: r.count,
      color: PERSONAL_CAT_COLORS[subToBucket[r.cat] || ''] || '#c9a87a',
    })),
    byPerson: personRows.map((r) => ({
      personId: r.person_id,
      name: r.name || 'Unknown',
      total: r.total,
      count: r.count,
    })),
    byMonth: monthRows.map((r) => ({
      month: r.month,
      income: r.income || 0,
      expenses: r.expenses || 0,
      net: (r.income || 0) - (r.expenses || 0),
    })),
  };
}

export interface RecurringForecast {
  txId: string;
  merchant: string;
  description: string;
  amount: number;
  frequency: string;          // MONTHLY | WEEKLY | BIWEEKLY | QUARTERLY | ANNUAL
  nextDate: string | null;
  label: string | null;
  alertDays: number | null;
  accountId: string;
  isPersonal: boolean;
  confirmedEntity: string | null;
  subCategory2: string | null;
  /** Forecast instances generated forward from nextDate, until 12 months ahead. */
  forecast: Array<{ date: string; amount: number }>;
  monthlyEquivalent: number;
  annualEquivalent: number;
}

const FREQ_DAYS: Record<string, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  QUARTERLY: 91,
  ANNUAL: 365,
};
const FREQ_PER_YEAR: Record<string, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
};

/** Get all recurring transactions, optionally filtered to personal only. */
export function recurringForecasts({ personalOnly = false, monthsAhead = 12 }: { personalOnly?: boolean; monthsAhead?: number } = {}): RecurringForecast[] {
  const db = getDb();
  const where: string[] = ['is_recurring = 1'];
  if (personalOnly) where.push("COALESCE(confirmed_entity, entity_tag) = 'PERSONAL'");
  // Pick the MOST RECENT instance per (merchant_name, account_id, frequency) so re-tagged duplicates don't double up.
  const rows = db.prepare(`
    SELECT
      id, merchant_name, description, amount, account_id,
      recurring_frequency, recurring_next_date, recurring_label, recurring_alert_days,
      confirmed_entity, entity_tag, sub_category_2,
      posting_date
    FROM transactions
    WHERE ${where.join(' AND ')}
    ORDER BY posting_date DESC
  `).all() as any[];

  // Dedupe by (merchant + account + frequency)
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const r of rows) {
    const key = `${(r.merchant_name || r.description || '').slice(0, 60)}|${r.account_id}|${r.recurring_frequency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + monthsAhead);

  return unique.map((r) => {
    const freq = r.recurring_frequency || 'MONTHLY';
    const dayStep = FREQ_DAYS[freq] || 30;
    const amount = Math.abs(r.amount);
    const forecast: Array<{ date: string; amount: number }> = [];

    // Anchor: explicit recurring_next_date, else (posting_date + freq)
    let anchor = r.recurring_next_date
      ? new Date(r.recurring_next_date)
      : new Date(new Date(r.posting_date).getTime() + dayStep * 24 * 3600 * 1000);

    while (anchor <= cutoff) {
      forecast.push({ date: anchor.toISOString().slice(0, 10), amount });
      anchor = new Date(anchor.getTime() + dayStep * 24 * 3600 * 1000);
    }

    const perYear = FREQ_PER_YEAR[freq] || 12;
    return {
      txId: r.id,
      merchant: r.merchant_name || r.description.slice(0, 50),
      description: r.description,
      amount: r.amount,
      frequency: freq,
      nextDate: r.recurring_next_date,
      label: r.recurring_label,
      alertDays: r.recurring_alert_days,
      accountId: r.account_id,
      isPersonal: (r.confirmed_entity || r.entity_tag) === 'PERSONAL',
      confirmedEntity: r.confirmed_entity || r.entity_tag,
      subCategory2: r.sub_category_2,
      forecast,
      monthlyEquivalent: amount * (perYear / 12),
      annualEquivalent: amount * perYear,
    };
  });
}
