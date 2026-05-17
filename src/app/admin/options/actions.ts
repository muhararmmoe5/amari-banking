'use server';

import { revalidatePath } from 'next/cache';
import { createOption, deleteOption, renameOption, type OptionField } from '@/lib/db/options';
import { getCurrentUser } from '@/lib/auth';

function checkOwner() {
  const u = getCurrentUser();
  if (!u || u.role !== 'OWNER') throw new Error('Only the owner can manage options');
}

function revalidateAll() {
  revalidatePath('/admin/options');
  revalidatePath('/transactions');
}

export async function actCreateOption(field: OptionField, value: string) {
  checkOwner();
  const o = createOption(field, value);
  revalidateAll();
  return o;
}

export async function actDeleteOption(id: string) {
  checkOwner();
  deleteOption(id);
  revalidateAll();
}

export async function actRenameOption(id: string, value: string) {
  checkOwner();
  renameOption(id, value);
  revalidateAll();
}
