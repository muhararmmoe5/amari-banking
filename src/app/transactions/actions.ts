'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  updateTransaction,
  type UpdateTxPatch,
  createTransaction,
  deleteTransaction,
  type CreateTxInput,
} from '@/lib/db/queries';
import { previewRecurringAllocation } from '@/lib/db/forecasts';
import { requireUser } from '@/lib/auth';

export async function saveTransaction(id: string, patch: UpdateTxPatch) {
  updateTransaction(id, patch);
  revalidatePath('/transactions');
  revalidatePath('/audit');
  revalidatePath('/');
}

export async function recurringAllocationPreviewAction(
  txId: string,
  expectedAmount: number,
  frequency: string,
) {
  requireUser();
  return previewRecurringAllocation(txId, expectedAmount, frequency);
}

export async function bulkApplyTagsAction(txIds: string[], patch: UpdateTxPatch): Promise<{ updated: number }> {
  const user = requireUser();
  if (user.role !== 'OWNER') throw new Error('Only the owner can bulk-tag');
  for (const id of txIds) {
    if (typeof id !== 'string' || id.length > 64) continue;
    updateTransaction(id, patch);
  }
  revalidatePath('/transactions');
  revalidatePath('/audit');
  revalidatePath('/');
  return { updated: txIds.length };
}

export async function createTransactionAction(input: CreateTxInput): Promise<{ id: string }> {
  const user = requireUser();
  if (user.role !== 'OWNER') throw new Error('Only the owner can add transactions');
  if (!input.accountId || !input.postingDate || !input.description || typeof input.amount !== 'number') {
    throw new Error('Missing required fields');
  }
  if (!isFinite(input.amount) || input.amount === 0) {
    throw new Error('Amount must be a non-zero number');
  }
  const id = createTransaction(input);
  revalidatePath('/transactions');
  revalidatePath('/');
  return { id };
}

export async function deleteTransactionAction(id: string): Promise<void> {
  const user = requireUser();
  if (user.role !== 'OWNER') throw new Error('Only the owner can delete transactions');
  if (!id || typeof id !== 'string') throw new Error('Invalid id');
  deleteTransaction(id);
  revalidatePath('/transactions');
  revalidatePath('/');
  redirect('/transactions');
}
