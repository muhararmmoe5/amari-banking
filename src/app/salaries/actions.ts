'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import {
  listSalaries, createSalary, updateSalary, deleteSalary,
  type SalaryInput,
} from '@/lib/db/salaries';

function ensureOwner() {
  const user = requireUser();
  if (user.role !== 'OWNER') throw new Error('Only the owner can manage salaries');
  return user;
}

export async function listSalariesAction() {
  ensureOwner();
  return listSalaries();
}

export async function createSalaryAction(input: SalaryInput) {
  ensureOwner();
  const s = createSalary(input);
  revalidatePath('/salaries');
  revalidatePath('/transactions');
  revalidatePath('/');
  return s;
}

export async function updateSalaryAction(id: string, patch: Partial<SalaryInput>) {
  ensureOwner();
  updateSalary(id, patch);
  revalidatePath('/salaries');
  revalidatePath('/transactions');
  revalidatePath('/');
}

export async function deleteSalaryAction(id: string) {
  ensureOwner();
  deleteSalary(id);
  revalidatePath('/salaries');
  revalidatePath('/transactions');
}
