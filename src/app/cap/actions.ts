'use server';

import { revalidatePath } from 'next/cache';
import {
  createPerson, updatePerson, deletePerson, getPerson, listPeople,
  createHolding, updateHolding, deleteHolding,
  createContribution, deleteContribution,
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
