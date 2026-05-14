import 'server-only';
import crypto from 'crypto';
import { getDb } from './index';
import type {
  Person, PersonRole, EquityHolding, CashContribution, SafeNote, EntityCapSummary,
} from '@/types/cap';
import type { EntityType } from '@/types';

// ===== People =====

function rowToPerson(r: any): Person {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listPeople(): Person[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM people ORDER BY name COLLATE NOCASE').all() as any[]).map(rowToPerson);
}

export function getPerson(id: string): Person | null {
  const db = getDb();
  const r = db.prepare('SELECT * FROM people WHERE id = ?').get(id) as any;
  return r ? rowToPerson(r) : null;
}

export interface PersonInput {
  name: string;
  email?: string | null;
  role?: PersonRole;
  notes?: string | null;
}

export function createPerson(input: PersonInput): Person {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO people (id, name, email, role, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.name.trim(), input.email?.trim() || null, input.role || 'OTHER', input.notes?.trim() || null, now, now);
  return getPerson(id)!;
}

export function updatePerson(id: string, patch: Partial<PersonInput>): void {
  const db = getDb();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id, updated_at: Date.now() };
  if (patch.name !== undefined) { fields.push('name = @name'); params.name = patch.name.trim(); }
  if (patch.email !== undefined) { fields.push('email = @email'); params.email = patch.email?.trim() || null; }
  if (patch.role !== undefined) { fields.push('role = @role'); params.role = patch.role; }
  if (patch.notes !== undefined) { fields.push('notes = @notes'); params.notes = patch.notes?.trim() || null; }
  if (!fields.length) return;
  fields.push('updated_at = @updated_at');
  db.prepare(`UPDATE people SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deletePerson(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM people WHERE id = ?').run(id);
}

// ===== Equity holdings =====

function rowToHolding(r: any): EquityHolding {
  return {
    id: r.id,
    entity: r.entity,
    personId: r.person_id,
    percent: r.percent,
    shares: r.shares,
    grantDate: r.grant_date,
    vestingCliffMonths: r.vesting_cliff_months,
    vestingTotalMonths: r.vesting_total_months,
    vestingStart: r.vesting_start,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listHoldings(entity?: EntityType): EquityHolding[] {
  const db = getDb();
  const rows = entity
    ? (db.prepare('SELECT * FROM equity_holdings WHERE entity = ? ORDER BY percent DESC').all(entity) as any[])
    : (db.prepare('SELECT * FROM equity_holdings ORDER BY entity, percent DESC').all() as any[]);
  return rows.map(rowToHolding);
}

export interface HoldingInput {
  entity: EntityType;
  personId: string;
  percent: number;
  shares?: number | null;
  grantDate?: string | null;
  vestingCliffMonths?: number | null;
  vestingTotalMonths?: number | null;
  vestingStart?: string | null;
  notes?: string | null;
}

export function createHolding(input: HoldingInput): EquityHolding {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO equity_holdings (id, entity, person_id, percent, shares, grant_date,
       vesting_cliff_months, vesting_total_months, vesting_start, notes, created_at, updated_at)
     VALUES (@id, @entity, @person_id, @percent, @shares, @grant_date,
       @vesting_cliff_months, @vesting_total_months, @vesting_start, @notes, @now, @now)`
  ).run({
    id,
    entity: input.entity,
    person_id: input.personId,
    percent: input.percent,
    shares: input.shares ?? null,
    grant_date: input.grantDate || null,
    vesting_cliff_months: input.vestingCliffMonths ?? null,
    vesting_total_months: input.vestingTotalMonths ?? null,
    vesting_start: input.vestingStart || null,
    notes: input.notes?.trim() || null,
    now,
  });
  return rowToHolding(db.prepare('SELECT * FROM equity_holdings WHERE id = ?').get(id) as any);
}

export function updateHolding(id: string, patch: Partial<HoldingInput>): void {
  const db = getDb();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id, updated_at: Date.now() };
  const map: Record<string, string> = {
    entity: 'entity',
    personId: 'person_id',
    percent: 'percent',
    shares: 'shares',
    grantDate: 'grant_date',
    vestingCliffMonths: 'vesting_cliff_months',
    vestingTotalMonths: 'vesting_total_months',
    vestingStart: 'vesting_start',
    notes: 'notes',
  };
  for (const [k, col] of Object.entries(map)) {
    if ((patch as any)[k] === undefined) continue;
    fields.push(`${col} = @${col}`);
    params[col] = (patch as any)[k];
  }
  if (!fields.length) return;
  fields.push('updated_at = @updated_at');
  db.prepare(`UPDATE equity_holdings SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

export function deleteHolding(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM equity_holdings WHERE id = ?').run(id);
}

// ===== Cash contributions =====

function rowToContribution(r: any): CashContribution {
  return {
    id: r.id,
    entity: r.entity,
    personId: r.person_id,
    amountCents: r.amount_cents,
    contributionDate: r.contribution_date,
    type: r.type,
    linkedTransactionId: r.linked_transaction_id,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export function listContributions(entity?: EntityType): CashContribution[] {
  const db = getDb();
  const rows = entity
    ? (db.prepare('SELECT * FROM cash_contributions WHERE entity = ? ORDER BY contribution_date DESC').all(entity) as any[])
    : (db.prepare('SELECT * FROM cash_contributions ORDER BY contribution_date DESC').all() as any[]);
  return rows.map(rowToContribution);
}

export interface ContributionInput {
  entity: EntityType;
  personId: string;
  amountCents: number;
  contributionDate: string;
  type?: CashContribution['type'];
  linkedTransactionId?: string | null;
  notes?: string | null;
}

export function createContribution(input: ContributionInput): CashContribution {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO cash_contributions (id, entity, person_id, amount_cents, contribution_date, type, linked_transaction_id, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.entity,
    input.personId,
    input.amountCents,
    input.contributionDate,
    input.type || 'CASH',
    input.linkedTransactionId || null,
    input.notes?.trim() || null,
    Date.now(),
  );
  return rowToContribution(db.prepare('SELECT * FROM cash_contributions WHERE id = ?').get(id) as any);
}

export function deleteContribution(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM cash_contributions WHERE id = ?').run(id);
}

// ===== SAFE / Convertible notes =====

function rowToSafe(r: any): SafeNote {
  return {
    id: r.id,
    entity: r.entity,
    personId: r.person_id,
    amountCents: r.amount_cents,
    issueDate: r.issue_date,
    valuationCapCents: r.valuation_cap_cents,
    discountPct: r.discount_pct,
    mfn: !!r.mfn,
    noteType: r.note_type,
    interestRatePct: r.interest_rate_pct,
    maturityDate: r.maturity_date,
    status: r.status,
    convertedAt: r.converted_at,
    convertedHoldingId: r.converted_holding_id,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export function listSafes(entity?: EntityType): SafeNote[] {
  const db = getDb();
  const rows = entity
    ? (db.prepare('SELECT * FROM safe_notes WHERE entity = ? ORDER BY issue_date DESC').all(entity) as any[])
    : (db.prepare('SELECT * FROM safe_notes ORDER BY issue_date DESC').all() as any[]);
  return rows.map(rowToSafe);
}

export interface SafeInput {
  entity: EntityType;
  personId: string;
  amountCents: number;
  issueDate: string;
  valuationCapCents?: number | null;
  discountPct?: number | null;
  mfn?: boolean;
  noteType?: 'SAFE' | 'CONVERTIBLE_NOTE';
  interestRatePct?: number | null;
  maturityDate?: string | null;
  notes?: string | null;
}

export function createSafe(input: SafeInput): SafeNote {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO safe_notes (id, entity, person_id, amount_cents, issue_date,
       valuation_cap_cents, discount_pct, mfn, note_type, interest_rate_pct, maturity_date,
       status, notes, created_at)
     VALUES (@id, @entity, @person_id, @amount_cents, @issue_date,
       @valuation_cap_cents, @discount_pct, @mfn, @note_type, @interest_rate_pct, @maturity_date,
       'OUTSTANDING', @notes, @now)`
  ).run({
    id,
    entity: input.entity,
    person_id: input.personId,
    amount_cents: input.amountCents,
    issue_date: input.issueDate,
    valuation_cap_cents: input.valuationCapCents ?? null,
    discount_pct: input.discountPct ?? null,
    mfn: input.mfn ? 1 : 0,
    note_type: input.noteType || 'SAFE',
    interest_rate_pct: input.interestRatePct ?? null,
    maturity_date: input.maturityDate || null,
    notes: input.notes?.trim() || null,
    now: Date.now(),
  });
  return rowToSafe(db.prepare('SELECT * FROM safe_notes WHERE id = ?').get(id) as any);
}

export function updateSafeStatus(id: string, status: 'OUTSTANDING' | 'CONVERTED' | 'CANCELED', convertedHoldingId?: string | null): void {
  const db = getDb();
  db.prepare(
    `UPDATE safe_notes SET status = ?, converted_at = ?, converted_holding_id = ? WHERE id = ?`
  ).run(
    status,
    status === 'CONVERTED' ? new Date().toISOString().slice(0, 10) : null,
    convertedHoldingId || null,
    id,
  );
}

export function deleteSafe(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM safe_notes WHERE id = ?').run(id);
}

// ===== Per-entity summary =====

export function entityCapSummary(entity: EntityType): EntityCapSummary {
  const db = getDb();
  const eq = db.prepare(
    `SELECT COALESCE(SUM(percent), 0) as totalPct, COALESCE(SUM(shares), 0) as totalShares, COUNT(*) as count FROM equity_holdings WHERE entity = ?`
  ).get(entity) as any;
  const cash = db.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) as total, COUNT(DISTINCT person_id) as contributors FROM cash_contributions WHERE entity = ?`
  ).get(entity) as any;
  const safes = db.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) as total, COUNT(*) as count FROM safe_notes WHERE entity = ? AND status = 'OUTSTANDING'`
  ).get(entity) as any;
  return {
    entity,
    totalEquityPct: eq.totalPct || 0,
    totalShares: eq.totalShares || 0,
    holderCount: eq.count || 0,
    totalCashCents: cash.total || 0,
    contributorCount: cash.contributors || 0,
    outstandingSafeCents: safes.total || 0,
    outstandingSafeCount: safes.count || 0,
  };
}

export function allEntitySummaries(): EntityCapSummary[] {
  const ents: EntityType[] = ['BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES', 'BYTES_REST_TECH'];
  return ents.map((e) => entityCapSummary(e));
}

// ===== Per-person cross-entity rollup =====

export interface PersonRollup {
  person: Person;
  holdings: EquityHolding[];
  contributions: CashContribution[];
  safes: SafeNote[];
  totalCashCents: number;
}

export function personRollup(personId: string): PersonRollup | null {
  const person = getPerson(personId);
  if (!person) return null;
  const db = getDb();
  const holdings = (db.prepare('SELECT * FROM equity_holdings WHERE person_id = ? ORDER BY entity').all(personId) as any[]).map(rowToHolding);
  const contributions = (db.prepare('SELECT * FROM cash_contributions WHERE person_id = ? ORDER BY contribution_date DESC').all(personId) as any[]).map(rowToContribution);
  const safes = (db.prepare('SELECT * FROM safe_notes WHERE person_id = ? ORDER BY issue_date DESC').all(personId) as any[]).map(rowToSafe);
  const totalCashCents = contributions.reduce((s, c) => s + c.amountCents, 0);
  return { person, holdings, contributions, safes, totalCashCents };
}
