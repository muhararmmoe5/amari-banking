'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import {
  createPerson, updatePerson, deletePerson, getPerson, listPeople,
  createHolding, updateHolding, deleteHolding,
  createContribution, updateContribution, deleteContribution,
  createSafe, updateSafeStatus, deleteSafe,
  createValuation, deleteValuation,
  createCommitment, deleteCommitment, updateCommitmentStatus, listCommitments,
  linkTransactionToCommitment,
  type PersonInput, type HoldingInput, type ContributionInput, type SafeInput,
  type ValuationInput, type CommitmentInput,
} from '@/lib/db/cap';
import { getDb } from '@/lib/db';
import { createInvite, type UserRole } from '@/lib/auth/sessions';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';

function revalidateAll() {
  revalidatePath('/cap');
  revalidatePath('/team');
  // Also revalidate dynamic entity sub-pages
  revalidatePath('/cap', 'layout');
}

export async function actCreatePerson(input: PersonInput) {
  const p = createPerson(input);
  revalidateAll();
  return p;
}
export async function actUpdatePerson(id: string, patch: Partial<PersonInput>) {
  updatePerson(id, patch);
  revalidateAll();
}
export async function actDeletePerson(id: string) {
  deletePerson(id);
  revalidateAll();
}

export async function actCreateHolding(input: HoldingInput) {
  const h = createHolding(input);
  revalidateAll();
  return h;
}
export async function actUpdateHolding(id: string, patch: Partial<HoldingInput>) {
  updateHolding(id, patch);
  revalidateAll();
}
export async function actDeleteHolding(id: string) {
  deleteHolding(id);
  revalidateAll();
}

export async function actCreateContribution(input: ContributionInput) {
  const c = createContribution(input);
  revalidateAll();
  return c;
}
export async function actUpdateContribution(id: string, patch: Partial<ContributionInput>) {
  updateContribution(id, patch);
  revalidateAll();
}

/** Force-sync: ensure every active cash contribution for (entity, person) has a
 *  matching active funding_commitment so wires can be tagged via the drawer.
 *  Idempotent — safe to call repeatedly. */
export async function actSyncContributionsToCommitments(entity: any) {
  checkOwner();
  const db = getDb();
  const rows = db.prepare(
    `SELECT DISTINCT entity, person_id, MAX(amount_cents) as total
     FROM cash_contributions WHERE entity = ?
     GROUP BY entity, person_id`
  ).all(entity) as any[];
  let totalLinked = 0;
  for (const r of rows) {
    let commitmentId: string;
    const existing = db.prepare(
      `SELECT id FROM funding_commitments WHERE entity = ? AND person_id = ? AND status = 'ACTIVE'`
    ).get(r.entity, r.person_id) as any;
    if (existing) {
      commitmentId = existing.id;
    } else {
      commitmentId = crypto.randomUUID();
      const now = Date.now();
      db.prepare(
        `INSERT INTO funding_commitments (id, entity, person_id, total_amount_cents, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`
      ).run(commitmentId, r.entity, r.person_id, r.total, now, now);
    }
    // Get the person's name so we can pattern-match incoming wires by description
    const person = db.prepare('SELECT name FROM people WHERE id = ?').get(r.person_id) as any;
    const personName = (person?.name || '').toUpperCase();
    // Auto-link all inflow transactions where the source_person_id matches, OR description
    // contains the person name, OR income_source matches a known investor code (SPACETEL,
    // OMAR_ALGHAZALI). Never overwrites a transaction that's already tagged to a commitment.
    const result = db.prepare(
      `UPDATE transactions
       SET funding_commitment_id = ?, updated_at = ?
       WHERE amount > 0
         AND funding_commitment_id IS NULL
         AND (source_person_id = ?
              OR upper(description) LIKE ?
              OR income_source IN ('SPACETEL', 'OMAR_ALGHAZALI'))`
    ).run(commitmentId, Date.now(), r.person_id, `%${personName}%`);
    totalLinked += Number(result.changes || 0);
  }
  revalidateAll();
  return { linked: totalLinked };
}

function checkOwner() {
  const u = getCurrentUser();
  if (!u || u.role !== 'OWNER') throw new Error('Owner only');
}

export async function actDeleteContribution(id: string) {
  deleteContribution(id);
  revalidateAll();
}

export async function actCreateSafe(input: SafeInput) {
  const s = createSafe(input);
  revalidateAll();
  return s;
}
export async function actUpdateSafeStatus(id: string, status: 'OUTSTANDING' | 'CONVERTED' | 'CANCELED') {
  updateSafeStatus(id, status);
  revalidateAll();
}
export async function actDeleteSafe(id: string) {
  deleteSafe(id);
  revalidateAll();
}

export async function actCreateValuation(input: ValuationInput) {
  const v = createValuation(input);
  revalidateAll();
  return v;
}
export async function actDeleteValuation(id: string) {
  deleteValuation(id);
  revalidateAll();
}

// ===== Funding commitments =====

export async function actCreateCommitment(input: CommitmentInput) {
  const c = createCommitment(input);
  revalidateAll();
  return c;
}

export async function actDeleteCommitment(id: string) {
  deleteCommitment(id);
  revalidateAll();
}

export async function actUpdateCommitmentStatus(id: string, status: 'ACTIVE' | 'COMPLETE' | 'CANCELED') {
  updateCommitmentStatus(id, status);
  revalidateAll();
}

export async function actLinkTransactionToCommitment(txId: string, commitmentId: string | null) {
  linkTransactionToCommitment(txId, commitmentId);
  revalidateAll();
  revalidatePath('/transactions');
}

/**
 * One-click seed: record the Omar Alghazali → Bytes AI deal
 * ($900k for 20% equity, funded $75k/month over 12 months).
 *
 * Idempotent: if an active Omar→Bytes AI commitment already exists, returns it.
 * Also auto-links all existing Spacetel / Omar Alghazali inflows on Amari
 * Ventures Hub (0320) and Bytes AI accounts to the new commitment.
 */
export async function actSeedOmarBytesDeal(): Promise<{ commitmentId: string; personId: string; holdingId: string; autoLinked: number }> {
  const user = getCurrentUser();
  if (!user || user.role !== 'OWNER') throw new Error('Only the owner can seed the cap table');

  // 1. Find or create Omar
  const people = listPeople();
  let omar = people.find((p) => /omar/i.test(p.name) && /alghazali/i.test(p.name));
  if (!omar) {
    omar = createPerson({ name: 'Omar Alghazali', role: 'INVESTOR', notes: 'Invests via Spacetel LLC wires' });
  }

  // 2. Check for an existing active commitment
  const existing = listCommitments('BYTES_AI').find((c) => c.personId === omar!.id && c.status === 'ACTIVE');
  if (existing) {
    return { commitmentId: existing.id, personId: omar.id, holdingId: existing.equityHoldingId || '', autoLinked: 0 };
  }

  // 3. Create the 20% equity holding
  const today = new Date().toISOString().slice(0, 10);
  const holding = createHolding({
    entity: 'BYTES_AI',
    personId: omar.id,
    percent: 20,
    holderType: 'INVESTOR',
    grantDate: today,
    notes: 'For $900k investment, funded $75k/month over 12 months',
  });

  // 4. Create the funding commitment
  const commitment = createCommitment({
    entity: 'BYTES_AI',
    personId: omar.id,
    totalAmountCents: 90_000_000,    // $900,000.00
    monthlyAmountCents: 7_500_000,   // $75,000.00
    equityPercent: 20,
    equityHoldingId: holding.id,
    startDate: today,
    notes: 'Funded as $75k/month wires via Spacetel LLC into Amari Ventures Hub (···0320).',
  });

  // 5. Auto-link existing Spacetel / Omar Alghazali inflows
  const db = getDb();
  const linkResult = db.prepare(
    `UPDATE transactions
     SET funding_commitment_id = ?, updated_at = ?
     WHERE amount > 0
       AND funding_commitment_id IS NULL
       AND (income_source IN ('SPACETEL', 'OMAR_ALGHAZALI')
            OR upper(description) LIKE '%SPACETEL%'
            OR upper(description) LIKE '%ALGHAZALI%')`
  ).run(commitment.id, Date.now());

  revalidateAll();
  revalidatePath('/transactions');

  return { commitmentId: commitment.id, personId: omar.id, holdingId: holding.id, autoLinked: Number(linkResult.changes) };
}

export async function actCreateInvite(personId: string, email: string, role: UserRole = 'PARTNER'): Promise<{ url: string; expiresAt: number } | { error: string }> {
  const user = getCurrentUser();
  if (!user || user.role !== 'OWNER') return { error: 'Only the owner can create invites' };
  const person = getPerson(personId);
  if (!person) return { error: 'Person not found' };
  if (!email.trim()) return { error: 'Email is required' };
  const invite = createInvite(personId, email, role, user.id);
  const h = headers();
  const host = h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const url = `${proto}://${host}/invite/${invite.token}`;
  return { url, expiresAt: invite.expiresAt };
}
