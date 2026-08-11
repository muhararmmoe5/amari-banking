'use server';

import { revalidatePath } from 'next/cache';
import { createBudget, updateBudget, deleteBudget, type BudgetInput, type BudgetStatus } from '@/lib/db/budgets';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';

function checkOwner() {
  const u = getCurrentUser();
  if (!u || !hasEditAccess(u)) throw new Error('Only the owner can manage budgets');
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

/**
 * Create a founder-allowance budget. Convenience wrapper over
 * createBudget with the founder-allowance kind pre-set. Everything the
 * caller cares about — entity, personId, monthly cap, month scope — is
 * inputs; name auto-generates from entity + person + month.
 */
export async function actCreateFounderAllowance(input: {
  entity: string;
  personId: string;
  personName: string;
  monthlyAmountCents: number;
  periodMonth?: string | null; // YYYY-MM, null = applies to every month by default
  linkedAccountIds?: string[]; // specific bank accounts to attribute against
  notes?: string | null;
}) {
  checkOwner();
  const monthLabel = input.periodMonth ? ` · ${input.periodMonth}` : '';
  const b = createBudget({
    name: `${input.personName} allowance from ${input.entity.replace(/_/g, ' ').toLowerCase()}${monthLabel}`,
    entity: input.entity as BudgetInput['entity'],
    kind: 'FOUNDER_ALLOWANCE',
    personId: input.personId,
    monthlyAmountCents: input.monthlyAmountCents,
    periodMonth: input.periodMonth || null,
    linkedAccountIds: input.linkedAccountIds || [],
    notes: input.notes || null,
  });
  revalidateAll();
  return b;
}
