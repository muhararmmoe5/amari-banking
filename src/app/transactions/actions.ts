'use server';

import { revalidatePath } from 'next/cache';
import { updateTransaction, type UpdateTxPatch } from '@/lib/db/queries';

export async function saveTransaction(id: string, patch: UpdateTxPatch) {
  updateTransaction(id, patch);
  revalidatePath('/transactions');
  revalidatePath('/audit');
  revalidatePath('/');
}
