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
import { requireUser, hasEditAccess } from '@/lib/auth';

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
  if (!hasEditAccess(user)) throw new Error('Only the owner can bulk-tag');
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
  if (!hasEditAccess(user)) throw new Error('Only the owner can add transactions');
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

export interface BulkApplyItem {
  txId: string;
  confirmedEntity?: string | null;
  confirmedCategory?: string | null;
  individual?: string | null;
  fundedByTransactionId?: string | null;
  markReviewed?: boolean;
}

export async function bulkApplyReviewsAction(items: BulkApplyItem[]): Promise<{ updated: number; skipped: number }> {
  const user = requireUser();
  if (!hasEditAccess(user)) throw new Error('Only editors and owners can bulk-review');
  let updated = 0;
  let skipped = 0;
  for (const item of items) {
    if (!item.txId || typeof item.txId !== 'string' || item.txId.length > 64) { skipped++; continue; }
    // Widen the patch type to string here — updateTransaction stores the
    // values as raw strings and the union types on UpdateTxPatch just
    // reflect the currently-known enum values, not a runtime constraint.
    const patch: UpdateTxPatch = {};
    if (item.confirmedEntity !== undefined) (patch as Record<string, unknown>).confirmedEntity = item.confirmedEntity;
    if (item.confirmedCategory !== undefined) (patch as Record<string, unknown>).confirmedCategory = item.confirmedCategory;
    if (item.individual !== undefined) patch.individual = item.individual;
    if (item.fundedByTransactionId !== undefined) patch.fundedByTransactionId = item.fundedByTransactionId;
    if (item.markReviewed) {
      patch.auditStatus = 'CONFIRMED';
      patch.reviewState = 'REVIEWED_APPROVED';
    }
    if (Object.keys(patch).length === 0) { skipped++; continue; }
    try { updateTransaction(item.txId, patch); updated++; } catch { skipped++; }
  }
  revalidatePath('/transactions');
  revalidatePath('/audit');
  revalidatePath('/');
  return { updated, skipped };
}

export async function deleteTransactionAction(id: string): Promise<void> {
  const user = requireUser();
  if (!hasEditAccess(user)) throw new Error('Only the owner can delete transactions');
  if (!id || typeof id !== 'string') throw new Error('Invalid id');
  deleteTransaction(id);
  revalidatePath('/transactions');
  revalidatePath('/');
  redirect('/transactions');
}
