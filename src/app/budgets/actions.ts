'use server';

import { revalidatePath } from 'next/cache';
import { createBudget, updateBudget, deleteBudget, type BudgetInput, type BudgetStatus } from '@/lib/db/budgets';
import { getCurrentUser } from '@/lib/auth';

function checkOwner() {
  const u = getCurrentUser();
  if (!u || u.role !== 'OWNER') throw new Error('Only the owner can manage budgets');
}

function revalidateAll() {
  revalidatePath('/budgets');
  revalidatePath('/transactions');
}

export async function actCreateBudget(input: BudgetInput) {
  checkOwner();
  const b = createBudget(input);
  revalidateAll();
  return b;
}

export async function actUpdateBudget(id: string, patch: Partial<BudgetInput> & { status?: BudgetStatus }) {
  checkOwner();
  updateBudget(id, patch);
  revalidateAll();
}

export async function actDeleteBudget(id: string) {
  checkOwner();
  deleteBudget(id);
  revalidateAll();
}
