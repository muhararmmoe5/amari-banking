import 'server-only';
import { getDb } from './index';
import { ENTITY_LABELS, ENTITY_COLORS, BUSINESS_ENTITIES } from '@/constants/accounts';
import type { EntityType } from '@/types';

const FREQ_PER_YEAR: Record<string, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
};

export interface EntityForecastItem {
  txId: string;
  merchant: string;
  label: string | null;
  frequency: string;
  monthlyShare: number;     // this entity's portion of the monthly equivalent
  annualShare: number;
  nextDate: string | null;
  sharePct: number;         // 0..1 of the recurring total going to this entity
}

export interface EntityForecast {
  entity: string;
  entityLabel: string;
  entityColor: string;
  monthlyTotal: number;
  annualTotal: number;
  itemCount: number;
  items: EntityForecastItem[];
}

interface RecurRow {
  id: string;
  merchant_name: string | null;
  description: string;
  amount: number;
  account_id: string;
  posting_date: string;
  recurring_frequency: string | null;
  recurring_next_date: string | null;
  recurring_label: string | null;
  recurring_expected_cents: number | null;
  confirmed_entity: string | null;
  entity_tag: string | null;
}

function entityLabel(k: string): string {
  return (ENTITY_LABELS as any)[k] || k;
}
function entityColor(k: string): string {
  return (ENTITY_COLORS as any)[k] || '#6f6e68';
}

/** Compute recurring monthly + annual cash burn per entity.
 *
 *  Allocation rule:
 *    - If a recurring transaction has split rows, allocate the recurring
 *      amount proportionally by each split's entity share.
 *    - Else attribute 100% to confirmed_entity (falling back to entity_tag,
 *      then UNKNOWN).
 *
 *  Amount source: `recurring_expected_cents` when set (the user's override
 *  when the wire is a partial payment), else abs(transaction.amount). */
export function recurringByEntity(): EntityForecast[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, merchant_name, description, amount, account_id, posting_date,
      recurring_frequency, recurring_next_date, recurring_label,
      recurring_expected_cents, confirmed_entity, entity_tag
    FROM transactions
    WHERE is_recurring = 1
    ORDER BY posting_date DESC
  `).all() as RecurRow[];

  // Dedupe per (merchant + account + frequency) — most recent wins.
  const seen = new Set<string>();
  const unique: RecurRow[] = [];
  for (const r of rows) {
    const key = `${(r.merchant_name || r.description || '').slice(0, 60)}|${r.account_id}|${r.recurring_frequency}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }

  const splitRows = db.prepare(`
    SELECT transaction_id, entity, amount_cents,
      is_recurring, recurring_frequency, recurring_expected_cents,
      recurring_next_date, recurring_label
    FROM transaction_splits
  `).all() as Array<{
    transaction_id: string;
    entity: string;
    amount_cents: number;
    is_recurring: number;
    recurring_frequency: string | null;
    recurring_expected_cents: number | null;
    recurring_next_date: string | null;
    recurring_label: string | null;
  }>;
  const splitsByTx = new Map<string, typeof splitRows>();
  for (const s of splitRows) {
    const arr = splitsByTx.get(s.transaction_id) || [];
    arr.push(s);
    splitsByTx.set(s.transaction_id, arr);
  }

  const acc = new Map<string, EntityForecast>();
  function bucketFor(ent: string): EntityForecast {
    let b = acc.get(ent);
    if (!b) {
      b = {
        entity: ent,
        entityLabel: entityLabel(ent),
        entityColor: entityColor(ent),
        monthlyTotal: 0,
        annualTotal: 0,
        itemCount: 0,
        items: [],
      };
      acc.set(ent, b);
    }
    return b;
  }

  for (const r of unique) {
    const splits = splitsByTx.get(r.id) || [];
    const anySplitRecurring = splits.some((s) => s.is_recurring);

    // If any split is recurring, per-split recurrence takes over for this
    // transaction — skip the transaction-level rollup entirely.
    if (anySplitRecurring) continue;

    const freq = r.recurring_frequency || 'MONTHLY';
    const perYear = FREQ_PER_YEAR[freq] || 12;
    const expected = r.recurring_expected_cents != null
      ? r.recurring_expected_cents / 100
      : Math.abs(r.amount);
    const monthly = expected * (perYear / 12);
    const annual = expected * perYear;

    const totalSplitCents = splits.reduce((s, x) => s + Math.abs(x.amount_cents), 0);

    type Alloc = { entity: string; pct: number };
    const allocations: Alloc[] = [];
    if (splits.length > 0 && totalSplitCents > 0) {
      for (const s of splits) {
        allocations.push({ entity: s.entity, pct: Math.abs(s.amount_cents) / totalSplitCents });
      }
    } else {
      const ent = r.confirmed_entity || r.entity_tag || 'UNKNOWN';
      allocations.push({ entity: ent, pct: 1 });
    }

    for (const a of allocations) {
      const b = bucketFor(a.entity);
      const m = monthly * a.pct;
      const y = annual * a.pct;
      b.monthlyTotal += m;
      b.annualTotal += y;
      b.itemCount += 1;
      b.items.push({
        txId: r.id,
        merchant: r.merchant_name || r.description.slice(0, 50),
        label: r.recurring_label,
        frequency: freq,
        monthlyShare: m,
        annualShare: y,
        nextDate: r.recurring_next_date,
        sharePct: a.pct,
      });
    }
  }

  // Per-split recurrences — each contributes independently to its own entity.
  const recurringSplitRows = db.prepare(`
    SELECT ts.transaction_id, ts.entity, ts.amount_cents,
      ts.recurring_frequency, ts.recurring_expected_cents,
      ts.recurring_next_date, ts.recurring_label,
      t.merchant_name, t.description
    FROM transaction_splits ts
    JOIN transactions t ON t.id = ts.transaction_id
    WHERE ts.is_recurring = 1
  `).all() as Array<{
    transaction_id: string;
    entity: string;
    amount_cents: number;
    recurring_frequency: string | null;
    recurring_expected_cents: number | null;
    recurring_next_date: string | null;
    recurring_label: string | null;
    merchant_name: string | null;
    description: string;
  }>;

  for (const s of recurringSplitRows) {
    const freq = s.recurring_frequency || 'MONTHLY';
    const perYear = FREQ_PER_YEAR[freq] || 12;
    const expected = s.recurring_expected_cents != null
      ? s.recurring_expected_cents / 100
      : Math.abs(s.amount_cents) / 100;
    const monthly = expected * (perYear / 12);
    const annual = expected * perYear;
    const b = bucketFor(s.entity);
    b.monthlyTotal += monthly;
    b.annualTotal += annual;
    b.itemCount += 1;
    b.items.push({
      txId: s.transaction_id,
      merchant: s.merchant_name || s.description.slice(0, 50),
      label: s.recurring_label,
      frequency: freq,
      monthlyShare: monthly,
      annualShare: annual,
      nextDate: s.recurring_next_date,
      sharePct: 1,
    });
  }

  return Array.from(acc.values()).sort((a, b) => b.monthlyTotal - a.monthlyTotal);
}

/** Per-entity allocation preview for ONE transaction, used by the drawer.
 *  Returns the entities the recurring amount would book to and how much. */
export function previewRecurringAllocation(
  txId: string,
  expectedAmount: number,
  frequency: string,
): EntityForecastItem[] & { entity: string }[] {
  const db = getDb();
  const tx = db.prepare(`
    SELECT confirmed_entity, entity_tag FROM transactions WHERE id = ?
  `).get(txId) as { confirmed_entity: string | null; entity_tag: string | null } | undefined;
  if (!tx) return [];

  const splits = db.prepare(`
    SELECT entity, amount_cents FROM transaction_splits WHERE transaction_id = ?
  `).all(txId) as Array<{ entity: string; amount_cents: number }>;
  const totalCents = splits.reduce((s, x) => s + Math.abs(x.amount_cents), 0);

  const perYear = FREQ_PER_YEAR[frequency] || 12;
  const monthly = expectedAmount * (perYear / 12);
  const annual = expectedAmount * perYear;

  type Alloc = { entity: string; pct: number };
  const allocations: Alloc[] = [];
  if (splits.length > 0 && totalCents > 0) {
    for (const s of splits) allocations.push({ entity: s.entity, pct: Math.abs(s.amount_cents) / totalCents });
  } else {
    allocations.push({ entity: tx.confirmed_entity || tx.entity_tag || 'UNKNOWN', pct: 1 });
  }

  return allocations.map((a) => ({
    txId,
    merchant: '',
    label: null,
    frequency,
    monthlyShare: monthly * a.pct,
    annualShare: annual * a.pct,
    nextDate: null,
    sharePct: a.pct,
    entity: a.entity,
  })) as any;
}
