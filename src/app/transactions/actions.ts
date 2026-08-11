'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  updateTransaction,
  getTransaction,
  type UpdateTxPatch,
  createTransaction,
  deleteTransaction,
  type CreateTxInput,
} from '@/lib/db/queries';
import type { AuthUser } from '@/lib/auth';
import { previewRecurringAllocation } from '@/lib/db/forecasts';
import { requireUser, hasEditAccess } from '@/lib/auth';
import type { EntityType, CategoryType } from '@/types';

// Allow-lists to reject bogus enum strings coming from clients or from
// the Claude classifier. Anything not on the list becomes null so the
// UI silently falls back to the existing value rather than persisting
// gibberish.
const VALID_ENTITIES = new Set<string>([
  'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES',
  'BYTES_REST_TECH', 'AMARI_HOLDINGS', 'PERSONAL', 'MULTI_ENTITY',
  'BUSINESS_SHARED', 'UNKNOWN',
]);
const VALID_CATEGORIES = new Set<string>([
  'INCOME_SPACETEL', 'INCOME_TCETRA', 'INCOME_STRIPE', 'INCOME_DOORDASH',
  'INCOME_GRUBHUB', 'INCOME_UBEREATS', 'INCOME_WIRE', 'INCOME_ZELLE',
  'INCOME_OTHER', 'EXPENSE_PAYROLL', 'EXPENSE_SOFTWARE_BYTES',
  'EXPENSE_SOFTWARE_GENERAL', 'EXPENSE_PROCESSING_FEES',
  'EXPENSE_COGS_FOOD', 'EXPENSE_COGS_WIRELESS', 'EXPENSE_RENT',
  'EXPENSE_TRAVEL', 'EXPENSE_FOOD_DINING', 'EXPENSE_TRANSPORT',
  'EXPENSE_FUEL', 'EXPENSE_INSURANCE', 'EXPENSE_WIRE_INTL',
  'EXPENSE_WIRE_DOMESTIC', 'EXPENSE_REMITTANCE', 'EXPENSE_ZELLE',
  'EXPENSE_APPLE_CASH', 'EXPENSE_PAYPAL', 'EXPENSE_CREDIT_CARD_PMT',
  'EXPENSE_BANK_FEES', 'EXPENSE_PERSONAL', 'EXPENSE_MARKETING',
  'EXPENSE_CONTRACTORS', 'EXPENSE_CASH_DEPOSIT', 'INTERNAL_TRANSFER',
  'UNCATEGORIZED',
]);
function safeEntity(v: string | null | undefined): EntityType | null {
  if (v == null) return null;
  return VALID_ENTITIES.has(v) ? (v as EntityType) : null;
}
function safeCategory(v: string | null | undefined): CategoryType | null {
  if (v == null) return null;
  return VALID_CATEGORIES.has(v) ? (v as CategoryType) : null;
}

/**
 * Non-editors (PARTNER / TEAM_MEMBER cofounders) can edit ONLY transactions
 * they have claimed as their own. Internal helper — 'use server' files
 * can only export async functions, so this stays module-local.
 */
function canEditThisTransaction(user: AuthUser, txId: string): boolean {
  if (hasEditAccess(user)) return true;
  const tx = getTransaction(txId);
  if (!tx) return false;
  const claimant = (tx.individual || '').trim().toLowerCase();
  const me = (user.name || user.email || '').trim().toLowerCase();
  return !!me && me === claimant;
}

/**
 * The subset of UpdateTxPatch keys a claimant (team member) is allowed to
 * change. Broadly: category, purpose, personal notes, and their own claim
 * on the row.
 *
 * Explicitly NOT allowed for team members (only admins can touch these):
 *  - audit status / review state (bookkeeping oversight)
 *  - funding source, custom source tag, sourceBusiness, sourceOfMoney,
 *    needToGetFrom, taggedDate (all financial-linkage / source-of-money
 *    fields — the owner explicitly wants team members locked out of these)
 *  - needs_identification (would let them un-flag other people's charges)
 *  - reassignment of `individual` to someone other than themselves
 */
const CLAIMANT_ALLOWED_KEYS: readonly (keyof UpdateTxPatch)[] = [
  'confirmedCategory', 'businessPurpose', 'notes',
  'subCategory1', 'subCategory2', 'individual',
  'receiptRef',
];
function narrowPatchForClaimant(patch: UpdateTxPatch, ownName: string): UpdateTxPatch {
  const out: UpdateTxPatch = {};
  for (const key of CLAIMANT_ALLOWED_KEYS) {
    if (patch[key] !== undefined) {
      // Cast pattern needed because UpdateTxPatch is a union of nullable
      // fields — TS can't narrow the key/value tuple in a plain loop.
      (out as Record<string, unknown>)[key] = patch[key];
    }
  }
  // If they try to reassign `individual` to someone else, snap it back.
  if (out.individual !== undefined && out.individual) {
    const target = out.individual.trim().toLowerCase();
    if (target !== ownName.trim().toLowerCase()) {
      out.individual = ownName;
    }
  }
  return out;
}

export async function saveTransaction(id: string, patch: UpdateTxPatch) {
  const user = requireUser();
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) throw new Error('invalid id');
  if (hasEditAccess(user)) {
    updateTransaction(id, patch);
  } else {
    // Non-editors can only save if this row is claimed to them, and only
    // to a narrowed set of fields — see narrowPatchForClaimant above.
    if (!canEditThisTransaction(user, id)) {
      throw new Error('you can only edit transactions claimed to you');
    }
    updateTransaction(id, narrowPatchForClaimant(patch, user.name || user.email));
  }
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
  customSourceTag?: string | null;
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
    // Enum values are allow-listed; anything unrecognized becomes null.
    // Prevents Claude or a bad client from persisting garbage like
    // 'OopsCorp' as confirmed_entity.
    const patch: UpdateTxPatch = {};
    if (item.confirmedEntity !== undefined) patch.confirmedEntity = safeEntity(item.confirmedEntity);
    if (item.confirmedCategory !== undefined) patch.confirmedCategory = safeCategory(item.confirmedCategory);
    if (item.individual !== undefined) patch.individual = item.individual;
    if (item.customSourceTag !== undefined) patch.customSourceTag = item.customSourceTag;
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

/**
 * Flag / unflag a transaction as "I don't know whose this is". Puts it in
 * the /identify queue for cofounders to review. Requires edit access
 * (owner/editor) — the flagger is usually the owner reviewing statements.
 */
export async function flagForIdentificationAction(
  id: string,
  needsId: boolean,
  note: string | null = null,
): Promise<void> {
  const user = requireUser();
  if (!hasEditAccess(user)) throw new Error('read-only role cannot flag');
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) throw new Error('invalid id');
  updateTransaction(id, {
    needsIdentification: !!needsId,
    identificationNote: needsId ? (note?.trim() || null) : null,
  });
  revalidatePath('/transactions');
  revalidatePath('/identify');
  revalidatePath('/');
}

/**
 * Claim a flagged transaction as belonging to a specific person. Any
 * signed-in user can claim (PARTNER/TEAM_MEMBER cofounders included) —
 * that's the whole point of the queue. Sets `individual` to the given
 * name and clears the needs_identification flag.
 *
 * If the caller is a PARTNER/TEAM_MEMBER we force `whose` to their own
 * profile name so they can only claim rows for themselves, not for
 * other people. Owners/editors can claim on behalf of anyone.
 */
export async function claimTransactionAction(
  id: string,
  whose: string,
): Promise<void> {
  const user = requireUser();
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) throw new Error('invalid id');
  const clean = (whose || '').trim().slice(0, 120);
  if (!clean) throw new Error('name required');
  // Non-editors can only claim for themselves — no impersonation.
  const finalName = hasEditAccess(user) ? clean : (user.name || user.email);
  updateTransaction(id, {
    individual: finalName,
    needsIdentification: false,
    identificationNote: null,
  });
  revalidatePath('/transactions');
  revalidatePath('/identify');
  revalidatePath('/');
}

/** Tiny setter for the inline tag editor on /flow — accepts one tx id and
 *  a new custom_source_tag value, saves, returns nothing. */
export async function saveCustomSourceTagAction(id: string, tag: string | null): Promise<void> {
  const user = requireUser();
  if (typeof id !== 'string' || id.length > 64) throw new Error('bad id');
  // Only admins (OWNER/EDITOR) may set the custom source tag — this is
  // the 'source of money' field the owner explicitly wants team members
  // locked out of.
  if (!hasEditAccess(user)) {
    throw new Error('only admins can set the source-of-money tag');
  }
  const clean = tag && tag.trim() ? tag.trim().slice(0, 200) : null;
  updateTransaction(id, { customSourceTag: clean });
  revalidatePath('/flow');
  revalidatePath('/transactions');
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
