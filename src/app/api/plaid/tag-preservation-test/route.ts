import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { applyPlaidTransaction } from '@/lib/db/plaid-sync';
import { computeFingerprint } from '@/lib/db/fingerprint';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Tag-preservation test (CLAUDE.md §Tag preservation guarantee).
 *
 *  Inserts a synthetic CSV transaction → attaches manual tags →
 *  runs a simulated Plaid sync that should merge with it →
 *  asserts that the manual tags survive untouched and the row was
 *  promoted to source='plaid' with external_id set.
 *
 *  Returns { ok: true } when all assertions pass; { ok: false, failed: [...] }
 *  when any fail. Run before shipping any Plaid sync changes. */
export async function POST() {
  const u = getCurrentUser();
  if (!u || !hasEditAccess(u)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const failures: string[] = [];

  // 1. Make sure an account exists to attach the test transaction to.
  const account = db.prepare('SELECT id FROM accounts LIMIT 1').get() as { id: string } | undefined;
  if (!account) {
    return NextResponse.json({ ok: false, failed: ['No accounts exist — seed at least one first'] });
  }

  // 2. Insert a synthetic CSV transaction.
  const id = crypto.randomUUID();
  const date = '2099-01-01'; // far-future date so we don't collide with real data
  const amount = -12.34;
  const description = 'TAG-TEST MERCHANT (SYNTHETIC)';
  const fingerprint = computeFingerprint(amount, date, description);
  const now = Date.now();
  try {
    db.prepare(`
      INSERT INTO transactions (
        id, account_id, posting_date, description, amount, merchant_name,
        category, entity_tag, audit_status, audit_flags, audit_score,
        imported_at, updated_at, hash, source, fingerprint, merchant_normalized
      ) VALUES (?, ?, ?, ?, ?, ?, 'UNCATEGORIZED', 'UNKNOWN', 'UNREVIEWED', '[]', 0, ?, ?, ?, 'csv', ?, ?)
    `).run(id, account.id, date, description, amount, description, now, now, crypto.randomUUID(), fingerprint, 'tag test merchant');
  } catch (e: any) {
    return NextResponse.json({ ok: false, failed: [`Insert failed: ${e?.message}`] });
  }

  // 3. Apply manual tagging to it.
  db.prepare(`
    UPDATE transactions SET
      confirmed_entity = 'BYTES_AI',
      sub_category_1 = 'PAYROLL',
      sub_category_2 = 'Contractor payment — 1099',
      individual = 'Test Person',
      notes = 'Manual tag — must survive Plaid sync',
      review_state = 'REVIEWED_APPROVED',
      reviewer_name = 'Test Reviewer',
      tagged_date = '2099-01-01',
      updated_at = ?
    WHERE id = ?
  `).run(Date.now(), id);

  // 4. Simulate a Plaid sync that matches the same fingerprint.
  applyPlaidTransaction({
    transactionId: 'plaid-test-' + Date.now(),
    accountId: account.id,
    date,
    name: 'Plaid Renamed Merchant',
    merchantName: 'Plaid Renamed Merchant',
    amount,
    pending: false,
    raw: { synthetic: true, test: 'tag-preservation' },
  });

  // 5. Assert.
  const after = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
  if (!after) failures.push('Transaction disappeared after Plaid sync');
  else {
    if (after.source !== 'plaid') failures.push(`source should be 'plaid', got '${after.source}'`);
    if (!after.external_id) failures.push('external_id should be set after merge');
    if (after.confirmed_entity !== 'BYTES_AI') failures.push(`confirmed_entity should survive, got '${after.confirmed_entity}'`);
    if (after.sub_category_1 !== 'PAYROLL') failures.push(`sub_category_1 should survive, got '${after.sub_category_1}'`);
    if (after.sub_category_2 !== 'Contractor payment — 1099') failures.push(`sub_category_2 should survive, got '${after.sub_category_2}'`);
    if (after.individual !== 'Test Person') failures.push(`individual should survive, got '${after.individual}'`);
    if (after.notes !== 'Manual tag — must survive Plaid sync') failures.push('notes should survive');
    if (after.review_state !== 'REVIEWED_APPROVED') failures.push(`review_state should survive, got '${after.review_state}'`);
    if (after.reviewer_name !== 'Test Reviewer') failures.push('reviewer_name should survive');
    if (after.tagged_date !== '2099-01-01') failures.push('tagged_date should survive');
    if (after.merchant_name !== 'Plaid Renamed Merchant') failures.push('merchant_name should have been refreshed by Plaid');
  }

  // 6. Clean up the synthetic row regardless of outcome.
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);

  return NextResponse.json(
    failures.length === 0 ? { ok: true } : { ok: false, failed: failures },
    { status: failures.length === 0 ? 200 : 500 }
  );
}
