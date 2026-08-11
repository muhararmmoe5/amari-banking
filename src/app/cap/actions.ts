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
import { getCurrentUser, hasEditAccess } from '@/lib/auth';
import { headers } from 'next/headers';

function revalidateAll() {
  revalidatePath('/cap');
  revalidatePath('/team');
  revalidatePath('/cap', 'layout');
}

// Every mutating cap-table action must go through this. Throws (which
// becomes a server-action error the client can surface) rather than
// silently no-op'ing so misuse is visible in dev tools.
function checkOwner() {
  const u = getCurrentUser();
  if (!u || !hasEditAccess(u)) throw new Error('Only editors and owners can modify the cap table');
  return u;
}

export async function actCreatePerson(input: PersonInput) {
  checkOwner();
  const p = createPerson(input);
  revalidateAll();
  return p;
}
export async function actUpdatePerson(id: string, patch: Partial<PersonInput>) {
  checkOwner();
  updatePerson(id, patch);
  revalidateAll();
}
export async function actDeletePerson(id: string) {
  checkOwner();
  deletePerson(id);
  revalidateAll();
}

export async function actCreateHolding(input: HoldingInput) {
  checkOwner();
  const h = createHolding(input);
  revalidateAll();
  return h;
}
/** Editing a holding must not silently reparent it to a different entity or
 *  person — that would let a compromised editor swap themselves onto someone
 *  else's stake. Reject any patch that would change identity fields. */
export async function actUpdateHolding(id: string, patch: Partial<HoldingInput>) {
  checkOwner();
  const safe: Partial<HoldingInput> = { ...patch };
  delete (safe as { entity?: unknown }).entity;
  delete (safe as { personId?: unknown }).personId;
  updateHolding(id, safe);
  revalidateAll();
}
export async function actDeleteHolding(id: string) {
  checkOwner();
  deleteHolding(id);
  revalidateAll();
}

export async function actCreateContribution(input: ContributionInput) {
  checkOwner();
  const c = createContribution(input);
  revalidateAll();
  return c;
}
export async function actUpdateContribution(id: string, patch: Partial<ContributionInput>) {
  checkOwner();
  updateContribution(id, patch);
  revalidateAll();
}
export async function actDeleteContribution(id: string) {
  checkOwner();
  deleteContribution(id);
  revalidateAll();
}

export async function actCreateSafe(input: SafeInput) {
  checkOwner();
  const s = createSafe(input);
  revalidateAll();
  return s;
}
export async function actUpdateSafeStatus(id: string, status: 'OUTSTANDING' | 'CONVERTED' | 'CANCELED') {
  checkOwner();
  updateSafeStatus(id, status);
  revalidateAll();
}
export async function actDeleteSafe(id: string) {
  checkOwner();
  deleteSafe(id);
  revalidateAll();
}

export async function actCreateValuation(input: ValuationInput) {
  checkOwner();
  const v = createValuation(input);
  revalidateAll();
  return v;
}
export async function actDeleteValuation(id: string) {
  checkOwner();
  deleteValuation(id);
  revalidateAll();
}

// ===== Funding commitments =====

export async function actCreateCommitment(input: CommitmentInput) {
  checkOwner();
  const c = createCommitment(input);
  revalidateAll();
  return c;
}

export async function actDeleteCommitment(id: string) {
  checkOwner();
  deleteCommitment(id);
  revalidateAll();
}

export async function actUpdateCommitmentStatus(id: string, status: 'ACTIVE' | 'COMPLETE' | 'CANCELED') {
  checkOwner();
  updateCommitmentStatus(id, status);
  revalidateAll();
}

export async function actLinkTransactionToCommitment(txId: string, commitmentId: string | null) {
  checkOwner();
  linkTransactionToCommitment(txId, commitmentId);
  revalidateAll();
  revalidatePath('/transactions');
}

/** Force-sync: ensure every active cash contribution for (entity, person) has a
 *  matching active funding_commitment so wires can be tagged via the drawer.
 *  Idempotent — safe to call repeatedly. */
export async function actSyncContributionsToCommitments(entity: string) {
  checkOwner();
  const db = getDb();
  const rows = db.prepare(
    `SELECT DISTINCT entity, person_id, MAX(amount_cents) as total
     FROM cash_contributions WHERE entity = ?
     GROUP BY entity, person_id`
  ).all(entity) as Array<{ entity: string; person_id: string; total: number }>;
  let totalLinked = 0;
  for (const r of rows) {
    let commitmentId: string;
    const existing = db.prepare(
      `SELECT id FROM funding_commitments WHERE entity = ? AND person_id = ? AND status = 'ACTIVE'`
    ).get(r.entity, r.person_id) as { id: string } | undefined;
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
    // Fetch the person's name so we can pattern-match incoming wires by
    // description. Reject names that would break the LIKE — bare "%" or "_"
    // would match every row; a 2-char name is too broad to be useful.
    const person = db.prepare('SELECT name FROM people WHERE id = ?').get(r.person_id) as { name: string } | undefined;
    const personName = (person?.name || '').toUpperCase();
    if (personName.length < 4 || /[%_]/.test(personName)) {
      // Only match by source_person_id and income_source for these — skip
      // the description LIKE which would be too greedy.
      const result = db.prepare(
        `UPDATE transactions
         SET funding_commitment_id = ?, updated_at = ?
         WHERE amount > 0
           AND funding_commitment_id IS NULL
           AND (source_person_id = ?
                OR income_source IN ('SPACETEL', 'OMAR_ALGHAZALI'))`
      ).run(commitmentId, Date.now(), r.person_id);
      totalLinked += Number(result.changes || 0);
      continue;
    }
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

/**
 * One-click seed: record the Omar Alghazali → Bytes AI deal
 * ($900k for 20% equity, funded $75k/month over 12 months).
 *
 * Idempotent: if an active Omar→Bytes AI commitment already exists, returns it.
 * Also auto-links all existing Spacetel / Omar Alghazali inflows on Amari
 * Ventures Hub (0320) and Bytes AI accounts to the new commitment.
 */
export async function actSeedOmarBytesDeal(): Promise<{ commitmentId: string; personId: string; holdingId: string; autoLinked: number }> {
  checkOwner();

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

/**
 * Only true OWNERs can hand out the OWNER role via invite — otherwise an
 * EDITOR could grant themselves an accomplice with root access. Everything
 * else (EDITOR / PARTNER / TEAM_MEMBER) stays gated on hasEditAccess.
 */
const INVITE_ROLES: UserRole[] = ['OWNER', 'EDITOR', 'PARTNER', 'TEAM_MEMBER'];
function normalizeInviteRole(role: UserRole | undefined, callerRole: UserRole): UserRole {
  const r = INVITE_ROLES.includes(role as UserRole) ? (role as UserRole) : 'PARTNER';
  if (r === 'OWNER' && callerRole !== 'OWNER') return 'PARTNER';
  return r;
}

export async function actCreateInvite(personId: string, email: string, role: UserRole = 'PARTNER'): Promise<{ url: string; expiresAt: number } | { error: string }> {
  const user = getCurrentUser();
  if (!user || !hasEditAccess(user)) return { error: 'Only editors and owners can create invites' };
  const person = getPerson(personId);
  if (!person) return { error: 'Person not found' };
  if (!email.trim()) return { error: 'Email is required' };
  const safeRole = normalizeInviteRole(role, user.role);
  const invite = createInvite(personId, email, safeRole, user.id);
  const h = headers();
  const host = h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const url = `${proto}://${host}/invite/${invite.token}`;
  return { url, expiresAt: invite.expiresAt };
}
