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
  /** Which entity is fronting the money for this part (e.g. AMARI_HOLDINGS).
   *  When sourceEntity !== entity, the booking entity owes the source entity. */
  sourceEntity: string | null;
  sourceAccountId: string | null;
  /** Per-part recurrence — when the transaction is split, recurrence
   *  lives on each split independently so e.g. the $3k Bytes AI rent
   *  share can be monthly while the $1k Delicious Bytes share is quarterly. */
  isRecurring: boolean;
  recurringFrequency: string | null;
  recurringNextDate: string | null;
  recurringLabel: string | null;
  recurringAlertDays: number | null;
  recurringAlertDays2: number | null;
  recurringExpectedCents: number | null;
  /** Money flow per-part — reimbursement entity + downstream money chain. */
  needToGetFrom: string | null;
  hop2Person: string | null;
  hop3Entity: string | null;
  /** Passed onward per-part — when the economic hit lands on a different entity. */
  passedOnward: boolean;
  passthroughEntity: string | null;
  passthroughPurpose: string | null;
  passthroughNotes: string | null;
  /** Master records this split allocates against. */
  salaryId: string | null;
  budgetId: string | null;
  /** Original economic owner of the money sitting in sourceEntity.
   *  When set and ≠ sourceEntity, sourceEntity was acting as a pass-through
   *  on behalf of ownerEntity (e.g. money was wired earlier from Bytes AI to
   *  Amari Holdings, and Amari Holdings is now spending it on Bytes AI's
   *  behalf — no real debt is created, it's Bytes AI's own money). */
  ownerEntity: string | null;
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
    sourceEntity: r.source_entity ?? null,
    sourceAccountId: r.source_account_id ?? null,
    isRecurring: !!r.is_recurring,
    recurringFrequency: r.recurring_frequency ?? null,
    recurringNextDate: r.recurring_next_date ?? null,
    recurringLabel: r.recurring_label ?? null,
    recurringAlertDays: r.recurring_alert_days ?? null,
    recurringAlertDays2: r.recurring_alert_days_2 ?? null,
    recurringExpectedCents: r.recurring_expected_cents ?? null,
    needToGetFrom: r.need_to_get_from ?? null,
    hop2Person: r.hop2_person ?? null,
    hop3Entity: r.hop3_entity ?? null,
    passedOnward: !!r.passed_onward,
    passthroughEntity: r.passthrough_entity ?? null,
    passthroughPurpose: r.passthrough_purpose ?? null,
    passthroughNotes: r.passthrough_notes ?? null,
    salaryId: r.salary_id ?? null,
    budgetId: r.budget_id ?? null,
    ownerEntity: r.owner_entity ?? null,
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
  sourceEntity?: string | null;
  sourceAccountId?: string | null;
  isRecurring?: boolean;
  recurringFrequency?: string | null;
  recurringNextDate?: string | null;
  recurringLabel?: string | null;
  recurringAlertDays?: number | null;
  recurringAlertDays2?: number | null;
  recurringExpectedCents?: number | null;
  needToGetFrom?: string | null;
  hop2Person?: string | null;
  hop3Entity?: string | null;
  passedOnward?: boolean;
  passthroughEntity?: string | null;
  passthroughPurpose?: string | null;
  passthroughNotes?: string | null;
  salaryId?: string | null;
  budgetId?: string | null;
  ownerEntity?: string | null;
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
        period_start, period_end, source_entity, source_account_id,
        is_recurring, recurring_frequency, recurring_next_date,
        recurring_label, recurring_alert_days, recurring_alert_days_2,
        recurring_expected_cents,
        need_to_get_from, hop2_person, hop3_entity,
        passed_onward, passthrough_entity, passthrough_purpose, passthrough_notes,
        salary_id, budget_id, owner_entity,
        sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    input.sourceEntity || null,
    input.sourceAccountId || null,
    input.isRecurring ? 1 : 0,
    input.recurringFrequency || null,
    input.recurringNextDate || null,
    input.recurringLabel?.trim() || null,
    input.recurringAlertDays ?? null,
    input.recurringAlertDays2 ?? null,
    input.recurringExpectedCents ?? null,
    input.needToGetFrom?.trim() || null,
    input.hop2Person?.trim() || null,
    input.hop3Entity || null,
    input.passedOnward ? 1 : 0,
    input.passthroughEntity || null,
    input.passthroughPurpose?.trim() || null,
    input.passthroughNotes?.trim() || null,
    input.salaryId || null,
    input.budgetId || null,
    input.ownerEntity || null,
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
  sourceEntity?: string | null;
  sourceAccountId?: string | null;
  isRecurring?: boolean;
  recurringFrequency?: string | null;
  recurringNextDate?: string | null;
  recurringLabel?: string | null;
  recurringAlertDays?: number | null;
  recurringAlertDays2?: number | null;
  recurringExpectedCents?: number | null;
  needToGetFrom?: string | null;
  hop2Person?: string | null;
  hop3Entity?: string | null;
  passedOnward?: boolean;
  passthroughEntity?: string | null;
  passthroughPurpose?: string | null;
  passthroughNotes?: string | null;
  salaryId?: string | null;
  budgetId?: string | null;
  ownerEntity?: string | null;
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
    sourceEntity: 'source_entity',
    sourceAccountId: 'source_account_id',
    isRecurring: 'is_recurring',
    recurringFrequency: 'recurring_frequency',
    recurringNextDate: 'recurring_next_date',
    recurringLabel: 'recurring_label',
    recurringAlertDays: 'recurring_alert_days',
    recurringAlertDays2: 'recurring_alert_days_2',
    recurringExpectedCents: 'recurring_expected_cents',
    needToGetFrom: 'need_to_get_from',
    hop2Person: 'hop2_person',
    hop3Entity: 'hop3_entity',
    passedOnward: 'passed_onward',
    passthroughEntity: 'passthrough_entity',
    passthroughPurpose: 'passthrough_purpose',
    passthroughNotes: 'passthrough_notes',
    salaryId: 'salary_id',
    budgetId: 'budget_id',
    ownerEntity: 'owner_entity',
    sortOrder: 'sort_order',
  };
  for (const [k, col] of Object.entries(map)) {
    if ((patch as any)[k] === undefined) continue;
    fields.push(`${col} = @${col}`);
    let val = (patch as any)[k];
    if (typeof val === 'string') val = val.trim().slice(0, 1024);
    if (typeof val === 'boolean') val = val ? 1 : 0;
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
