'use server';

import { revalidatePath } from 'next/cache';
import {
  createPerson, updatePerson, deletePerson,
  createHolding, updateHolding, deleteHolding,
  createContribution, deleteContribution,
  createSafe, updateSafeStatus, deleteSafe,
  type PersonInput, type HoldingInput, type ContributionInput, type SafeInput,
} from '@/lib/db/cap';

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
