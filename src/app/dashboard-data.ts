import 'server-only';
import { getDb } from '@/lib/db';
import { listCommitments, listPeople } from '@/lib/db/cap';
import type { EntityType } from '@/types';

/** 14-day rolling net flow per entity (sum of daily amount), suitable for sparkline display. */
export function entitySparkData(): Record<EntityType, number[]> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - 13);
  const sinceStr = since.toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT COALESCE(confirmed_entity, entity_tag) as entity, posting_date, SUM(amount) as day_net
    FROM transactions
    WHERE posting_date >= ?
      AND is_internal = 0
    GROUP BY entity, posting_date
    ORDER BY posting_date ASC
  `).all(sinceStr) as Array<{ entity: EntityType; posting_date: string; day_net: number }>;

  const days: string[] = [];
  const cur = new Date(since);
  for (let i = 0; i < 14; i++) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  const byEntity: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (!byEntity[r.entity]) byEntity[r.entity] = {};
    byEntity[r.entity][r.posting_date] = r.day_net;
  }
  // Build cumulative series per entity over the 14-day window
  const out: Record<string, number[]> = {};
  for (const ent of Object.keys(byEntity)) {
    let running = 0;
    const series: number[] = [];
    for (const d of days) {
      running += byEntity[ent][d] || 0;
      series.push(running);
    }
    out[ent] = series;
  }
  return out as Record<EntityType, number[]>;
}

/** Money flow source/destination buckets for the Sankey, from real transactions. */
export interface FlowBucket { id: string; label: string; amount: number; color: string }
export function moneyFlowBuckets(dateFrom?: string, dateTo?: string): { sources: FlowBucket[]; destinations: FlowBucket[] } {
  const db = getDb();
  const where: string[] = ['is_internal = 0'];
  const params: any[] = [];
  if (dateFrom) { where.push('posting_date >= ?'); params.push(dateFrom); }
  if (dateTo) { where.push('posting_date <= ?'); params.push(dateTo); }
  const w = `WHERE ${where.join(' AND ')}`;

  // Sources: aggregate by income_source for inflows
  const srcRows = db.prepare(`
    SELECT COALESCE(income_source, 'OTHER') as src, SUM(amount) as total
    FROM transactions ${w} AND amount > 0
    GROUP BY src
    ORDER BY total DESC
  `).all(...params) as Array<{ src: string; total: number }>;
  const srcColorMap: Record<string, string> = {
    STRIPE: '#6b8aa8',
    SPACETEL: '#c9a87a',
    OMAR_ALGHAZALI: '#c9a87a',
    TCETRA: '#7a8c6b',
    VIDAPAY: '#7a8c6b',
    DOORDASH: '#c98a7a',
    GRUBHUB: '#c98a7a',
    UBER_EATS: '#c98a7a',
    ZELLE_IN: '#b18ac9',
    WIRE_UNKNOWN: '#c9b8a8',
    OTHER: '#9f9a8c',
  };
  const srcLabel: Record<string, string> = {
    STRIPE: 'Stripe',
    SPACETEL: 'Spacetel / Omar',
    OMAR_ALGHAZALI: 'Omar Alghazali',
    TCETRA: 'TCETRA',
    VIDAPAY: 'Vidapay',
    DOORDASH: 'DoorDash',
    GRUBHUB: 'Grubhub',
    UBER_EATS: 'Uber Eats',
    ZELLE_IN: 'Zelle inbound',
    WIRE_UNKNOWN: 'Unknown wires',
    OTHER: 'Other inflows',
  };
  const sources: FlowBucket[] = srcRows.slice(0, 6).map((r) => ({
    id: r.src,
    label: srcLabel[r.src] || r.src,
    amount: Math.round(r.total),
    color: srcColorMap[r.src] || '#9f9a8c',
  })).filter((s) => s.amount > 0);

  // Destinations: aggregate by category for outflows
  const dstRows = db.prepare(`
    SELECT COALESCE(confirmed_category, category) as cat, SUM(ABS(amount)) as total
    FROM transactions ${w} AND amount < 0
    GROUP BY cat
    ORDER BY total DESC
  `).all(...params) as Array<{ cat: string; total: number }>;
  const destColorMap: Record<string, string> = {
    EXPENSE_PAYROLL: '#b18ac9',
    EXPENSE_COGS: '#c98a7a',
    EXPENSE_SOFTWARE: '#6b8aa8',
    EXPENSE_MARKETING: '#c9a87a',
    EXPENSE_OPERATIONS: '#7a8c6b',
    EXPENSE_TRAVEL: '#c9b8a8',
    EXPENSE_LEGAL: '#9f9a8c',
    EXPENSE_TAXES: '#88724a',
  };
  const destLabel = (raw: string) =>
    raw.replace(/^EXPENSE_/, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const destinations: FlowBucket[] = dstRows.slice(0, 5).map((r) => ({
    id: r.cat,
    label: destLabel(r.cat),
    amount: Math.round(r.total),
    color: destColorMap[r.cat] || '#9f9a8c',
  }));

  return { sources, destinations };
}

/** Investor commitments with received-from-wires + person name resolved. */
export interface InvestorRow {
  id: string;
  name: string;
  entity: EntityType;
  committed: number;
  received: number;
  equityPct: number | null;
  lastWireDate: string | null;
}
export function investorCommitments(): InvestorRow[] {
  const db = getDb();
  const commitments = listCommitments();
  const people = listPeople();
  const personById = new Map(people.map((p) => [p.id, p]));
  return commitments
    .filter((c) => c.status === 'ACTIVE')
    .map((c) => {
      const fundedRow = db.prepare(
        `SELECT COALESCE(SUM(amount), 0) as total, MAX(posting_date) as last_date
         FROM transactions WHERE funding_commitment_id = ? AND amount > 0`
      ).get(c.id) as any;
      return {
        id: c.id,
        name: personById.get(c.personId)?.name || 'Unknown',
        entity: c.entity,
        committed: Math.round((c.totalAmountCents || 0) / 100),
        received: Math.round(fundedRow.total || 0),
        equityPct: c.equityPercent,
        lastWireDate: fundedRow.last_date,
      };
    })
    .sort((a, b) => b.committed - a.committed);
}
