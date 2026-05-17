import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { extractTransactionDate } from '@/lib/parsers/extract-tx-date';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  const user = getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();
  // Re-scan any transaction whose transaction_date is currently null.
  const rows = db.prepare(
    'SELECT id, description, posting_date FROM transactions WHERE transaction_date IS NULL'
  ).all() as { id: string; description: string; posting_date: string }[];

  const update = db.prepare('UPDATE transactions SET transaction_date = ? WHERE id = ?');
  let updated = 0;
  let attempted = rows.length;
  const tx = db.transaction(() => {
    for (const r of rows) {
      const d = extractTransactionDate(r.description, r.posting_date);
      if (d) {
        update.run(d, r.id);
        updated += 1;
      }
    }
  });
  tx();
  revalidatePath('/transactions');
  return NextResponse.json({ scanned: attempted, populated: updated });
}
