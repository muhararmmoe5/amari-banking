import 'server-only';
import crypto from 'crypto';
import { getDb } from './index';

export interface TransactionSplit {
  id: string;
  transactionId: string;
  amountCents: number;
  entity: string;
  category: string | null;
  individual: string | null;
  subCategory1: string | null;
  subCategory2: string | null;
  businessPurpose: string | null;
  notes: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

function rowToSplit(r: any): TransactionSplit {
  return {
    id: r.id,
    transactionId: r.transaction_id,
    amountCents: r.amount_cents,
    entity: r.entity,
    category: r.category,
    individual: r.individual,
    subCategory1: r.sub_category_1,
    subCategory2: r.sub_category_2,
    businessPurpose: r.business_purpose,
    notes: r.notes,
    periodStart: r.period_start ?? null,
    periodEnd: r.period_end ?? null,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listSplits(transactionId: string): TransactionSplit[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM transaction_splits WHERE transaction_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).all(transactionId) as any[];
  return rows.map(rowToSplit);
}

export interface SplitInput {
  transactionId: string;
  amountCents: number;
  entity?: string;
  category?: string | null;
  individual?: string | null;
  subCategory1?: string | null;
  subCategory2?: string | null;
  businessPurpose?: string | null;
  notes?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  sortOrder?: number;
}

export function createSplit(input: SplitInput): TransactionSplit {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO transaction_splits
       (id, transaction_id, amount_cents, entity, category, individual,
        sub_category_1, sub_category_2, business_purpose, notes,
        period_start, period_end, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.transactionId,
    input.amountCents,
    (input.entity || 'UNKNOWN').trim().slice(0, 64),
    input.category?.trim() || null,
    input.individual?.trim() || null,
    input.subCategory1?.trim() || null,
    input.subCategory2?.trim() || null,
    input.businessPurpose?.trim() || null,
    input.notes?.trim() || null,
    input.periodStart || null,
    input.periodEnd || null,
    input.sortOrder ?? 0,
    now,
    now,
  );
  return rowToSplit(db.prepare('SELECT * FROM transaction_splits WHERE id = ?').get(id) as any);
}

export interface UpdateSplitPatch {
  amountCents?: number;
  entity?: string;
  category?: string | null;
  individual?: string | null;
  subCategory1?: string | null;
  subCategory2?: string | null;
  businessPurpose?: string | null;
  notes?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  sortOrder?: number;
}

export function updateSplit(id: string, patch: UpdateSplitPatch): void {
  const db = getDb();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id, updated_at: Date.now() };
  const map: Record<string, string> = {
    amountCents: 'amount_cents',
    entity: 'entity',
    category: 'category',
    individual: 'individual',
    subCategory1: 'sub_category_1',
    subCategory2: 'sub_category_2',
    businessPurpose: 'business_purpose',
    notes: 'notes',
    periodStart: 'period_start',
    periodEnd: 'period_end',
    sortOrder: 'sort_order',
  };
  for (const [k, col] of Object.entries(map)) {
    if ((patch as any)[k] === undefined) continue;
    fields.push(`${col} = @${col}`);
    let val = (patch as any)[k];
    if (typeof val === 'string') val = val.trim().slice(0, 1024);
    params[col] = val;
  }
  if (!fields.length) return;
  fields.push('updated_at = @updated_at');
  db.prepare(`UPDATE transaction_splits SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deleteSplit(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM transaction_splits WHERE id = ?').run(id);
}

export function getSplitCount(transactionId: string): number {
  const db = getDb();
  return (db.prepare('SELECT COUNT(*) c FROM transaction_splits WHERE transaction_id = ?').get(transactionId) as { c: number }).c;
}

export interface SplitRollup {
  transactionId: string;
  count: number;
  totalAllocatedCents: number;
}

export function rollupsByTransaction(transactionIds: string[]): Map<string, SplitRollup> {
  const out = new Map<string, SplitRollup>();
  if (transactionIds.length === 0) return out;
  const db = getDb();
  const placeholders = transactionIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT transaction_id as tx, COUNT(*) as c, SUM(amount_cents) as t
     FROM transaction_splits WHERE transaction_id IN (${placeholders}) GROUP BY tx`
  ).all(...transactionIds) as any[];
  for (const r of rows) {
    out.set(r.tx, { transactionId: r.tx, count: r.c, totalAllocatedCents: r.t || 0 });
  }
  return out;
}
