import 'server-only';
import crypto from 'crypto';
import { getDb } from './index';
import type { EntityType } from '@/types';

export type BudgetKind = 'EXPENSE' | 'INCOME';
export type BudgetStatus = 'ACTIVE' | 'ARCHIVED';

export interface Budget {
  id: string;
  name: string;
  entity: EntityType | null;
  kind: BudgetKind;
  monthlyAmountCents: number | null;
  notes: string | null;
  status: BudgetStatus;
  createdAt: number;
  updatedAt: number;
}

function rowToBudget(r: any): Budget {
  return {
    id: r.id,
    name: r.name,
    entity: r.entity,
    kind: r.kind,
    monthlyAmountCents: r.monthly_amount_cents,
    notes: r.notes,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface BudgetInput {
  name: string;
  entity?: EntityType | null;
  kind?: BudgetKind;
  monthlyAmountCents?: number | null;
  notes?: string | null;
}

export function listBudgets(opts: { activeOnly?: boolean } = {}): Budget[] {
  const db = getDb();
  const where = opts.activeOnly ? "WHERE status = 'ACTIVE'" : '';
  const rows = db.prepare(`SELECT * FROM budgets ${where} ORDER BY status ASC, name COLLATE NOCASE`).all() as any[];
  return rows.map(rowToBudget);
}

export function getBudget(id: string): Budget | null {
  const db = getDb();
  const r = db.prepare('SELECT * FROM budgets WHERE id = ?').get(id) as any;
  return r ? rowToBudget(r) : null;
}

export function createBudget(input: BudgetInput): Budget {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO budgets (id, name, entity, kind, monthly_amount_cents, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
  ).run(
    id,
    input.name.trim(),
    input.entity || null,
    input.kind || 'EXPENSE',
    input.monthlyAmountCents ?? null,
    input.notes?.trim() || null,
    now,
    now,
  );
  return getBudget(id)!;
}

export function updateBudget(id: string, patch: Partial<BudgetInput> & { status?: BudgetStatus }): void {
  const db = getDb();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id, updated_at: Date.now() };
  if (patch.name !== undefined) { fields.push('name = @name'); params.name = patch.name.trim(); }
  if (patch.entity !== undefined) { fields.push('entity = @entity'); params.entity = patch.entity; }
  if (patch.kind !== undefined) { fields.push('kind = @kind'); params.kind = patch.kind; }
  if (patch.monthlyAmountCents !== undefined) { fields.push('monthly_amount_cents = @monthly'); params.monthly = patch.monthlyAmountCents; }
  if (patch.notes !== undefined) { fields.push('notes = @notes'); params.notes = patch.notes?.trim() || null; }
  if (patch.status !== undefined) { fields.push('status = @status'); params.status = patch.status; }
  if (!fields.length) return;
  fields.push('updated_at = @updated_at');
  db.prepare(`UPDATE budgets SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deleteBudget(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
}

export interface BudgetWithSpend extends Budget {
  spentThisMonthCents: number;
  txCountThisMonth: number;
  spentAllTimeCents: number;
  txCountAllTime: number;
}

export function listBudgetsWithSpend(): BudgetWithSpend[] {
  const db = getDb();
  const budgets = listBudgets();
  const monthStart = new Date();
  monthStart.setDate(1);
  const startStr = monthStart.toISOString().slice(0, 10);

  return budgets.map((b) => {
    const month = db.prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as s, COUNT(*) as n FROM transactions
       WHERE budget_id = ? AND posting_date >= ?`
    ).get(b.id, startStr) as any;
    const all = db.prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as s, COUNT(*) as n FROM transactions WHERE budget_id = ?`
    ).get(b.id) as any;
    return {
      ...b,
      spentThisMonthCents: Math.round((month.s || 0) * 100),
      txCountThisMonth: month.n || 0,
      spentAllTimeCents: Math.round((all.s || 0) * 100),
      txCountAllTime: all.n || 0,
    };
  });
}
