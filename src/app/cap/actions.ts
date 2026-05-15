'use server';

import { revalidatePath } from 'next/cache';
import {
  createPerson, updatePerson, deletePerson, getPerson,
  createHolding, updateHolding, deleteHolding,
  createContribution, deleteContribution,
  createSafe, updateSafeStatus, deleteSafe,
  createValuation, deleteValuation,
  type PersonInput, type HoldingInput, type ContributionInput, type SafeInput,
  type ValuationInput,
} from '@/lib/db/cap';
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
