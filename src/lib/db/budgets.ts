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
  totalAmountCents: number | null;     // master cap (e.g. $900k)
  runwayMonths: number | null;          // how many months the total is spread over
  periodMonth: string | null;          // YYYY-MM — when set, this budget targets one specific month
  fundingCommitmentId: string | null;  // links to an investor's funding commitment
  subKind: BudgetSubKind | null;
  personId: string | null;             // person this budget tracks (e.g. the investor)
  linkedAccountIds: string[];          // specific bank accounts this budget scopes to
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
    totalAmountCents: r.total_amount_cents ?? null,
    runwayMonths: r.runway_months ?? null,
    periodMonth: r.period_month ?? null,
    fundingCommitmentId: r.funding_commitment_id ?? null,
    subKind: r.sub_kind ?? null,
    personId: r.person_id ?? null,
    linkedAccountIds: (r.linked_account_ids || '').split(',').map((s: string) => s.trim()).filter(Boolean),
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
  totalAmountCents?: number | null;
  runwayMonths?: number | null;
  periodMonth?: string | null;
  fundingCommitmentId?: string | null;
  subKind?: BudgetSubKind | null;
  personId?: string | null;
  linkedAccountIds?: string[];
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
  const linked = (input.linkedAccountIds || []).filter(Boolean).join(',') || null;
  db.prepare(
    `INSERT INTO budgets (id, name, entity, kind, monthly_amount_cents, total_amount_cents, runway_months, period_month, funding_commitment_id, sub_kind, person_id, linked_account_ids, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
  ).run(
    id,
    input.name.trim(),
    input.entity || null,
    input.kind || 'EXPENSE',
    input.monthlyAmountCents ?? null,
    input.totalAmountCents ?? null,
    input.runwayMonths ?? null,
    input.periodMonth || null,
    input.fundingCommitmentId || null,
    input.subKind || null,
    input.personId || null,
    linked,
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
  if (patch.totalAmountCents !== undefined) { fields.push('total_amount_cents = @total'); params.total = patch.totalAmountCents; }
  if (patch.runwayMonths !== undefined) { fields.push('runway_months = @runway'); params.runway = patch.runwayMonths; }
  if (patch.periodMonth !== undefined) { fields.push('period_month = @period_month'); params.period_month = patch.periodMonth || null; }
  if (patch.fundingCommitmentId !== undefined) { fields.push('funding_commitment_id = @commitment_id'); params.commitment_id = patch.fundingCommitmentId || null; }
  if (patch.subKind !== undefined) { fields.push('sub_kind = @sub_kind'); params.sub_kind = patch.subKind || null; }
  if (patch.personId !== undefined) { fields.push('person_id = @person_id'); params.person_id = patch.personId || null; }
  if (patch.linkedAccountIds !== undefined) {
    fields.push('linked_account_ids = @linked');
    params.linked = (patch.linkedAccountIds || []).filter(Boolean).join(',') || null;
  }
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

export interface BudgetTransaction {
  txId: string;
  postingDate: string;
  description: string;
  merchant: string | null;
  amountCents: number;        // positive for income, negative for expense
  accountId: string;
  entityTag: string;
}

export interface BudgetMonthBreakdown {
  month: string;              // YYYY-MM
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  txCount: number;
  overMonthlyCap: boolean;
}

export interface BudgetDetail {
  budget: Budget;
  personName: string | null;
  commitmentLabel: string | null;
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
  txCount: number;
  pctOfMaster: number | null;   // (income / totalAmountCents) * 100, if total set
  pctOfMonthlyCap: number | null;
  effectiveMonthIncomeCents: number;
  effectiveMonthExpenseCents: number;
  effectiveMonth: string;
  months: BudgetMonthBreakdown[];
  transactions: BudgetTransaction[];
}

export function getBudgetDetail(id: string): BudgetDetail | null {
  const b = getBudget(id);
  if (!b) return null;
  const db = getDb();

  // Person + commitment labels (same logic as listBudgetsWithSpend)
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

  const rows = db.prepare(`
    SELECT id, posting_date, description, merchant_name, amount, account_id, entity_tag
    FROM transactions
    WHERE budget_id = ?
    ORDER BY posting_date DESC, id DESC
  `).all(id) as any[];

  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  const monthMap = new Map<string, BudgetMonthBreakdown>();
  const transactions: BudgetTransaction[] = rows.map((r) => {
    const cents = Math.round(r.amount * 100);
    if (cents > 0) totalIncomeCents += cents;
    else totalExpenseCents += Math.abs(cents);
    const month = r.posting_date.slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { month, incomeCents: 0, expenseCents: 0, netCents: 0, txCount: 0, overMonthlyCap: false });
    }
    const m = monthMap.get(month)!;
    if (cents > 0) m.incomeCents += cents;
    else m.expenseCents += Math.abs(cents);
    m.netCents = m.incomeCents - m.expenseCents;
    m.txCount += 1;
    return {
      txId: r.id,
      postingDate: r.posting_date,
      description: r.description,
      merchant: r.merchant_name,
      amountCents: cents,
      accountId: r.account_id,
      entityTag: r.entity_tag,
    };
  });

  if (b.monthlyAmountCents) {
    for (const m of monthMap.values()) {
      const measure = b.kind === 'INCOME' ? m.incomeCents : m.expenseCents;
      m.overMonthlyCap = measure > b.monthlyAmountCents;
    }
  }

  const months = Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));

  const netCents = totalIncomeCents - totalExpenseCents;
  const pctOfMaster = b.totalAmountCents && b.totalAmountCents > 0
    ? ((b.kind === 'INCOME' ? totalIncomeCents : totalExpenseCents) / b.totalAmountCents) * 100
    : null;

  const effectiveMonth = b.periodMonth || new Date().toISOString().slice(0, 7);
  const emRow = monthMap.get(effectiveMonth);
  const pctOfMonthlyCap = b.monthlyAmountCents && b.monthlyAmountCents > 0 && emRow
    ? ((b.kind === 'INCOME' ? emRow.incomeCents : emRow.expenseCents) / b.monthlyAmountCents) * 100
    : null;

  return {
    budget: b,
    personName,
    commitmentLabel,
    totalIncomeCents,
    totalExpenseCents,
    netCents,
    txCount: transactions.length,
    pctOfMaster,
    pctOfMonthlyCap,
    effectiveMonthIncomeCents: emRow?.incomeCents || 0,
    effectiveMonthExpenseCents: emRow?.expenseCents || 0,
    effectiveMonth,
    months,
    transactions,
  };
}

// ═════════════════════════════════════════════════════════════════════
//   FOUNDER ALLOWANCES
// ═════════════════════════════════════════════════════════════════════
//
// A founder allowance is a monthly personal-spend cap the company gives
// a founder in lieu of formal salary. It's just a budget row with
// kind='FOUNDER_ALLOWANCE', person_id set to the founder, entity set to
// the paying company, and monthly_amount_cents as the cap. period_month
// optionally scopes the cap to a specific YYYY-MM.
//
// Spend attribution: transactions where individual matches the person's
// name (case-insensitive) AND the account belongs to `entity`. Direction
// negative (outflow) only — inbound reimbursements don't count against
// the cap.

export interface FounderAllowance extends Budget {
  personName: string;
}

export interface FounderAllowanceUsage extends FounderAllowance {
  /** How much has been spent in the effective month against this
   *  allowance. Absolute cents (always positive). */
  spentThisMonthCents: number;
  txCountThisMonth: number;
  /** monthly_amount_cents minus spentThisMonthCents, floored at 0. */
  remainingCents: number;
  /** Which YYYY-MM 'this month' refers to (periodMonth if set, else
   *  current calendar month). */
  effectiveMonth: string;
  /** Individual transaction rows counting against the allowance. */
  transactions: Array<{
    id: string;
    postingDate: string;
    merchant: string | null;
    description: string;
    amount: number; // signed
  }>;
}

export function listFounderAllowances(opts: { activeOnly?: boolean; personId?: string } = {}): FounderAllowance[] {
  const db = getDb();
  const clauses = ["kind = 'FOUNDER_ALLOWANCE'"];
  const params: Record<string, unknown> = {};
  if (opts.activeOnly) clauses.push("status = 'ACTIVE'");
  if (opts.personId) { clauses.push('person_id = @personId'); params.personId = opts.personId; }
  const rows = db.prepare(
    `SELECT b.*, p.name AS person_name
       FROM budgets b
       LEFT JOIN people p ON p.id = b.person_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY b.entity, b.period_month DESC NULLS LAST, b.name`
  ).all(params) as Array<Record<string, unknown> & { person_name?: string | null }>;
  return rows.map((r) => ({
    ...rowToBudget(r),
    personName: (r.person_name as string) || 'Unknown',
  }));
}

/**
 * Compute usage for a single founder allowance. Sums personal-spend
 * transactions tagged to the founder (by name) on accounts belonging
 * to the entity, within the effective month.
 */
export function getFounderAllowanceUsage(allowanceId: string): FounderAllowanceUsage | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT b.*, p.name AS person_name
       FROM budgets b
       LEFT JOIN people p ON p.id = b.person_id
       WHERE b.id = ? AND b.kind = 'FOUNDER_ALLOWANCE'`
  ).get(allowanceId) as (Record<string, unknown> & { person_name?: string | null }) | undefined;
  if (!row) return null;
  const budget = rowToBudget(row);
  const personName = (row.person_name as string) || 'Unknown';
  if (!budget.entity || !personName) {
    return {
      ...budget,
      personName,
      spentThisMonthCents: 0,
      txCountThisMonth: 0,
      remainingCents: budget.monthlyAmountCents ?? 0,
      effectiveMonth: budget.periodMonth || new Date().toISOString().slice(0, 7),
      transactions: [],
    };
  }
  const effectiveMonth = budget.periodMonth || new Date().toISOString().slice(0, 7);
  const { from, to } = monthBounds(effectiveMonth);
  const lowerName = personName.trim().toLowerCase();

  // Attribution model — a transaction counts against this allowance if
  // BOTH the person matches AND at least one of:
  //   (a) it's on an account explicitly linked to the budget
  //       (budgets.linked_account_ids), OR
  //   (b) it's booked to this entity via confirmed_entity — i.e. the
  //       user tagged the row 'Books to Bytes AI' even if the account
  //       itself is a personal card, OR
  //   (c) fallback: no explicit links AND the account's default entity
  //       matches the budget's entity (the previous default behavior).
  //
  // This handles the founder's case cleanly: 'I spent from my personal
  // card and tagged it to Bytes AI' — (b) picks it up. Or 'I linked the
  // Chase 6562 Bytes AI Main account explicitly' — (a) picks it up.
  const linked = budget.linkedAccountIds;
  const orClauses: string[] = [];
  const sqlParams: unknown[] = [];
  if (linked.length > 0) {
    orClauses.push(`account_id IN (${linked.map(() => '?').join(',')})`);
    sqlParams.push(...linked);
  }
  orClauses.push(`confirmed_entity = ?`);
  sqlParams.push(budget.entity);
  if (linked.length === 0) {
    // Only fall back to entity-mapped accounts when the user hasn't
    // explicitly linked any accounts — otherwise we'd double-count.
    const entityAccounts = db.prepare(`SELECT id FROM accounts WHERE entity = ?`).all(budget.entity) as Array<{ id: string }>;
    if (entityAccounts.length > 0) {
      const ids = entityAccounts.map((r) => r.id);
      orClauses.push(`account_id IN (${ids.map(() => '?').join(',')})`);
      sqlParams.push(...ids);
    }
  }
  const attributionSql = `(${orClauses.join(' OR ')})`;

  const txRows = db.prepare(
    `SELECT id, posting_date, description, merchant_name, amount
       FROM transactions
       WHERE amount < 0
         AND ${attributionSql}
         AND lower(trim(COALESCE(individual, ''))) = ?
         AND posting_date >= ?
         AND posting_date <= ?
       ORDER BY posting_date DESC, id DESC
       LIMIT 500`
  ).all(...sqlParams, lowerName, from, to) as Array<{
    id: string; posting_date: string; description: string; merchant_name: string | null; amount: number;
  }>;
  const spentCents = txRows.reduce((s, r) => s + Math.round(Math.abs(r.amount) * 100), 0);
  const cap = budget.monthlyAmountCents ?? 0;
  return {
    ...budget, personName,
    spentThisMonthCents: spentCents,
    txCountThisMonth: txRows.length,
    remainingCents: Math.max(0, cap - spentCents),
    effectiveMonth,
    transactions: txRows.map((r) => ({
      id: r.id,
      postingDate: r.posting_date,
      merchant: r.merchant_name,
      description: r.description,
      amount: r.amount,
    })),
  };
}

/** Bulk usage query for all active founder allowances — one DB pass
 *  per allowance, but returns everything the /budgets page needs to
 *  render the founder-allowance section. */
export function listFounderAllowancesWithUsage(): FounderAllowanceUsage[] {
  const allowances = listFounderAllowances({ activeOnly: true });
  return allowances
    .map((a) => getFounderAllowanceUsage(a.id))
    .filter((x): x is FounderAllowanceUsage => x !== null);
}
