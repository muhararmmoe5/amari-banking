'use server';

import { revalidatePath } from 'next/cache';
import { updateTransaction, type UpdateTxPatch } from '@/lib/db/queries';
import { requireUser } from '@/lib/auth';

export async function saveTransaction(id: string, patch: UpdateTxPatch) {
  updateTransaction(id, patch);
  revalidatePath('/transactions');
  revalidatePath('/audit');
  revalidatePath('/');
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
