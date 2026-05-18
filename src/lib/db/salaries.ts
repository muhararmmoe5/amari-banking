import 'server-only';
import crypto from 'crypto';
import { getDb } from './index';

export type SalaryKind = 'SALARY' | 'HOUSING' | 'STIPEND' | 'CONTRACTOR' | 'OTHER';
export type SalaryStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';

export interface Salary {
  id: string;
  personId: string;
  personName?: string;
  entity: string;
  kind: SalaryKind;
  monthlyAmountCents: number;
  label: string | null;
  notes: string | null;
  status: SalaryStatus;
  createdAt: number;
  updatedAt: number;
}

function rowToSalary(r: any): Salary {
  return {
    id: r.id,
    personId: r.person_id,
    personName: r.person_name ?? undefined,
    entity: r.entity,
    kind: r.kind as SalaryKind,
    monthlyAmountCents: r.monthly_amount_cents,
    label: r.label,
    notes: r.notes,
    status: r.status as SalaryStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listSalaries(opts: { activeOnly?: boolean; entity?: string; personId?: string } = {}): Salary[] {
  const db = getDb();
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (opts.activeOnly) { where.push("s.status = 'ACTIVE'"); }
  if (opts.entity) { where.push('s.entity = @entity'); params.entity = opts.entity; }
  if (opts.personId) { where.push('s.person_id = @personId'); params.personId = opts.personId; }
  const sql = `
    SELECT s.*, p.name AS person_name
    FROM salaries s
    LEFT JOIN people p ON p.id = s.person_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY s.entity, p.name COLLATE NOCASE
  `;
  return (db.prepare(sql).all(params) as any[]).map(rowToSalary);
}

export function getSalary(id: string): Salary | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT s.*, p.name AS person_name
    FROM salaries s
    LEFT JOIN people p ON p.id = s.person_id
    WHERE s.id = ?
  `).get(id) as any;
  return r ? rowToSalary(r) : null;
}

export interface SalaryInput {
  personId: string;
  entity: string;
  kind?: SalaryKind;
  monthlyAmountCents: number;
  label?: string | null;
  notes?: string | null;
  status?: SalaryStatus;
}

export function createSalary(input: SalaryInput): Salary {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO salaries (id, person_id, entity, kind, monthly_amount_cents, label, notes, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.personId,
    input.entity,
    input.kind || 'SALARY',
    input.monthlyAmountCents,
    input.label?.trim() || null,
    input.notes?.trim() || null,
    input.status || 'ACTIVE',
    now,
    now,
  );
  return getSalary(id)!;
}

export function updateSalary(id: string, patch: Partial<SalaryInput>): void {
  const db = getDb();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id, updated_at: Date.now() };
  const map: Record<string, string> = {
    personId: 'person_id',
    entity: 'entity',
    kind: 'kind',
    monthlyAmountCents: 'monthly_amount_cents',
    label: 'label',
    notes: 'notes',
    status: 'status',
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
  db.prepare(`UPDATE salaries SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deleteSalary(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM salaries WHERE id = ?').run(id);
}

/** Rollup: how much has been tagged against each salary (sum of split amounts
 *  whose split.salary_id matches, plus tx.salary_id for non-split). */
export interface SalarySpend {
  salaryId: string;
  taggedCents: number;   // total dollars allocated to this salary across all transactions/splits
  taggedCount: number;   // number of distinct splits/transactions tagged
}

export function spendBySalary(): Map<string, SalarySpend> {
  const db = getDb();
  const out = new Map<string, SalarySpend>();
  // From transaction_splits
  const splitRows = db.prepare(`
    SELECT salary_id, SUM(ABS(amount_cents)) AS amt, COUNT(*) AS c
    FROM transaction_splits
    WHERE salary_id IS NOT NULL
    GROUP BY salary_id
  `).all() as any[];
  for (const r of splitRows) {
    out.set(r.salary_id, { salaryId: r.salary_id, taggedCents: r.amt || 0, taggedCount: r.c || 0 });
  }
  // From transactions (non-split)
  const txRows = db.prepare(`
    SELECT salary_id, SUM(ABS(amount * 100)) AS amt, COUNT(*) AS c
    FROM transactions
    WHERE salary_id IS NOT NULL
    GROUP BY salary_id
  `).all() as any[];
  for (const r of txRows) {
    const existing = out.get(r.salary_id);
    out.set(r.salary_id, {
      salaryId: r.salary_id,
      taggedCents: (existing?.taggedCents || 0) + (r.amt || 0),
      taggedCount: (existing?.taggedCount || 0) + (r.c || 0),
    });
  }
  return out;
}
