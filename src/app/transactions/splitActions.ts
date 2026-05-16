'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import {
  listSplits, createSplit, updateSplit, deleteSplit,
  type SplitInput, type UpdateSplitPatch, type TransactionSplit,
} from '@/lib/db/splits';

function ensureOwner() {
  const user = requireUser();
  if (user.role !== 'OWNER') throw new Error('Only the owner can edit splits');
  return user;
}

function revalidateAll() {
  revalidatePath('/transactions');
  revalidatePath('/audit');
  revalidatePath('/');
  revalidatePath('/pl');
  revalidatePath('/cpa');
}

export async function listSplitsAction(transactionId: string): Promise<TransactionSplit[]> {
  ensureOwner();
  return listSplits(transactionId);
}

export async function createSplitAction(input: SplitInput): Promise<TransactionSplit> {
  ensureOwner();
  const s = createSplit(input);
  revalidateAll();
  return s;
}

export async function updateSplitAction(id: string, patch: UpdateSplitPatch): Promise<void> {
  ensureOwner();
  updateSplit(id, patch);
  revalidateAll();
}

export async function deleteSplitAction(id: string): Promise<void> {
  ensureOwner();
  deleteSplit(id);
  revalidateAll();
}
