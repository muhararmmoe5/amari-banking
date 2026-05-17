import 'server-only';
import crypto from 'crypto';
import { getDb } from './index';
import type { EntityType } from '@/types';

export { BUDGET_SUB_KINDS } from '@/lib/budget-kinds';
export type { BudgetKind, BudgetStatus, BudgetSubKind } from '@/lib/budget-kinds';
import type { BudgetKind, BudgetStatus, BudgetSubKind } from '@/lib/budget-kinds';

export interface Budget {
  id: string;
  name: string;
  entity: EntityType | null;
  kind: BudgetKind;
  monthlyAmountCents: number | null;
  periodMonth: string | null;          // YYYY-MM — when set, this budget targets one specific month
  fundingCommitmentId: string | null;  // links to an investor's funding commitment
  subKind: BudgetSubKind | null;
  personId: string | null;             // person this budget tracks (e.g. the investor)
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
    periodMonth: r.period_month ?? null,
    fundingCommitmentId: r.funding_commitment_id ?? null,
    subKind: r.sub_kind ?? null,
    personId: r.person_id ?? null,
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
  periodMonth?: string | null;
  fundingCommitmentId?: string | null;
  subKind?: BudgetSubKind | null;
  personId?: string | null;
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
    `INSERT INTO budgets (id, name, entity, kind, monthly_amount_cents, period_month, funding_commitment_id, sub_kind, person_id, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
  ).run(
    id,
    input.name.trim(),
    input.entity || null,
    input.kind || 'EXPENSE',
    input.monthlyAmountCents ?? null,
    input.periodMonth || null,
    input.fundingCommitmentId || null,
    input.subKind || null,
    input.personId || null,
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
  if (patch.periodMonth !== undefined) { fields.push('period_month = @period_month'); params.period_month = patch.periodMonth || null; }
  if (patch.fundingCommitmentId !== undefined) { fields.push('funding_commitment_id = @commitment_id'); params.commitment_id = patch.fundingCommitmentId || null; }
  if (patch.subKind !== undefined) { fields.push('sub_kind = @sub_kind'); params.sub_kind = patch.subKind || null; }
  if (patch.personId !== undefined) { fields.push('person_id = @person_id'); params.person_id = patch.personId || null; }
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
  /** Which month "this month" actually refers to — periodMonth if set, otherwise calendar month. */
  effectiveMonth: string;
  commitmentLabel: string | null;
  personName: string | null;
}

function monthBounds(yyyyMm: string): { from: string; to: string } {
  const [y, m] = yyyyMm.split('-').map((s) => parseInt(s, 10));
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(start), to: fmt(end) };
}

export function listBudgetsWithSpend(): BudgetWithSpend[] {
  const db = getDb();
  const budgets = listBudgets();

  return budgets.map((b) => {
    const effectiveMonth = b.periodMonth || new Date().toISOString().slice(0, 7);
    const { from, to } = monthBounds(effectiveMonth);
    const month = db.prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as s, COUNT(*) as n FROM transactions
       WHERE budget_id = ? AND posting_date >= ? AND posting_date <= ?`
    ).get(b.id, from, to) as any;
    const all = db.prepare(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as s, COUNT(*) as n FROM transactions WHERE budget_id = ?`
    ).get(b.id) as any;

    let personName: string | null = null;
    if (b.personId) {
      const p = db.prepare('SELECT name FROM people WHERE id = ?').get(b.personId) as any;
      personName = p?.name || null;
    }

    let commitmentLabel: string | null = null;
    if (b.fundingCommitmentId) {
      const c = db.prepare(`
        SELECT fc.total_amount_cents, fc.monthly_amount_cents, fc.equity_percent, p.name
        FROM funding_commitments fc
        LEFT JOIN people p ON p.id = fc.person_id
        WHERE fc.id = ?
      `).get(b.fundingCommitmentId) as any;
      if (c) {
        const parts: string[] = [c.name || 'Unknown'];
        if (c.monthly_amount_cents) parts.push(`$${(c.monthly_amount_cents / 100).toLocaleString()}/mo pledge`);
        if (c.equity_percent != null) parts.push(`${c.equity_percent}% equity`);
        commitmentLabel = parts.join(' · ');
      }
    }

    return {
      ...b,
      spentThisMonthCents: Math.round((month.s || 0) * 100),
      txCountThisMonth: month.n || 0,
      spentAllTimeCents: Math.round((all.s || 0) * 100),
      txCountAllTime: all.n || 0,
      effectiveMonth,
      commitmentLabel,
      personName,
    };
  });
}
