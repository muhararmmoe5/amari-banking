import 'server-only';
import crypto from 'crypto';
import { getDb } from '@/lib/db';

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24));
}

export interface ReconcileResult {
  matched: number;
  ambiguous: number;
}

export function runReconciliation(): ReconcileResult {
  const db = getDb();
  // Pull all unmatched internal transfers
  const rows = db.prepare(`
    SELECT id, account_id, posting_date, amount
    FROM transactions
    WHERE is_internal = 1 AND internal_linked_id IS NULL
  `).all() as { id: string; account_id: string; posting_date: string; amount: number }[];

  const debits = rows.filter((r) => r.amount < 0);
  const credits = rows.filter((r) => r.amount > 0);
  const usedCredits = new Set<string>();

  const insertMatch = db.prepare(
    `INSERT INTO reconciliation_matches (id, from_tx_id, to_tx_id, confidence, matched_at, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const updateTx = db.prepare(`UPDATE transactions SET internal_linked_id = ? WHERE id = ?`);

  let matched = 0;
  let ambiguous = 0;
  const tx = db.transaction(() => {
    for (const d of debits) {
      const candidates = credits.filter(
        (c) =>
          !usedCredits.has(c.id) &&
          c.account_id !== d.account_id &&
          Math.abs(c.amount - Math.abs(d.amount)) < 0.01 &&
          daysBetween(c.posting_date, d.posting_date) <= 2
      );
      if (candidates.length === 0) continue;
      const best = candidates.sort(
        (a, b) =>
          daysBetween(a.posting_date, d.posting_date) - daysBetween(b.posting_date, d.posting_date)
      )[0];
      const confidence = candidates.length === 1 ? 0.95 : 0.75;
      const matchId = crypto.randomUUID();
      insertMatch.run(matchId, d.id, best.id, confidence, Date.now(), 'AUTO_MATCHED');
      updateTx.run(best.id, d.id);
      updateTx.run(d.id, best.id);
      usedCredits.add(best.id);
      matched += 1;
      if (candidates.length > 1) ambiguous += 1;
    }
  });
  tx();
  return { matched, ambiguous };
}
