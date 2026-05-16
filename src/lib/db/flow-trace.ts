import 'server-only';
import { getDb } from '@/lib/db';

export interface TraceSource {
  txId: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;             // attributed amount in dollars
  totalInflow: number;        // original inflow amount
  isInternal: boolean;
  counterpartyAccountId: string | null;
  incomeSource: string | null;
  category: string;
}

export interface SourceTraceResult {
  target: {
    id: string;
    accountId: string;
    postingDate: string;
    description: string;
    merchant: string | null;
    amount: number;
    isInternal: boolean;
    confirmedEntity: string | null;
    entityTag: string;
    category: string;
    counterpartyAccountId: string | null;
  };
  // Sources are populated only when the target is an outflow on the same account.
  sources: TraceSource[];
  uncovered: number;           // amount we couldn't trace (no inflows left)
  notes: string[];
}

/**
 * FIFO attribution: replay every transaction on this account chronologically.
 * Track a queue of un-spent inflows. When we hit an outflow, drain inflows
 * (oldest first) until the outflow is covered. When we hit the target tx,
 * return its attribution.
 *
 * Internal transfers are treated as inflows (when amount > 0) or outflows
 * (when amount < 0) like anything else, but tagged so the UI can hint
 * "money came from ···XXXX — trace it there for the original source".
 */
export function traceFundingSource(txId: string): SourceTraceResult | null {
  const db = getDb();
  const target = db.prepare(`
    SELECT id, account_id, posting_date, description, merchant_name, amount,
      is_internal, internal_linked_id, confirmed_entity, entity_tag, category
    FROM transactions WHERE id = ?
  `).get(txId) as any;
  if (!target) return null;

  // Counterparty for internal transfers
  let counterpartyId: string | null = null;
  if (target.internal_linked_id) {
    const linked = db.prepare(`SELECT account_id FROM transactions WHERE id = ?`).get(target.internal_linked_id) as any;
    if (linked) counterpartyId = linked.account_id;
  }

  const targetSummary = {
    id: target.id,
    accountId: target.account_id,
    postingDate: target.posting_date,
    description: target.description,
    merchant: target.merchant_name,
    amount: target.amount,
    isInternal: !!target.is_internal,
    confirmedEntity: target.confirmed_entity,
    entityTag: target.entity_tag,
    category: target.category,
    counterpartyAccountId: counterpartyId,
  };

  const notes: string[] = [];

  // Only outflows have a "source" trace — inflows ARE the source.
  if (target.amount >= 0) {
    return { target: targetSummary, sources: [], uncovered: 0, notes };
  }

  // Pull all transactions on this account up to and including the target.
  // Order by posting_date, then by id for stable ordering within a day.
  const all = db.prepare(`
    SELECT t.id, t.posting_date, t.description, t.merchant_name, t.amount,
      t.is_internal, t.income_source, t.category,
      linked.account_id as counterparty_account_id
    FROM transactions t
    LEFT JOIN transactions linked ON linked.id = t.internal_linked_id
    WHERE t.account_id = ? AND (
      t.posting_date < ?
      OR (t.posting_date = ? AND t.id <= ?)
    )
    ORDER BY t.posting_date ASC, t.id ASC
  `).all(target.account_id, target.posting_date, target.posting_date, target.id) as any[];

  interface InflowSlot {
    txId: string;
    date: string;
    description: string;
    merchant: string | null;
    isInternal: boolean;
    counterpartyAccountId: string | null;
    incomeSource: string | null;
    category: string;
    originalAmount: number;
    remaining: number;
  }
  const queue: InflowSlot[] = [];

  for (const t of all) {
    if (t.amount > 0) {
      queue.push({
        txId: t.id,
        date: t.posting_date,
        description: t.description,
        merchant: t.merchant_name,
        isInternal: !!t.is_internal,
        counterpartyAccountId: t.counterparty_account_id,
        incomeSource: t.income_source,
        category: t.category,
        originalAmount: t.amount,
        remaining: t.amount,
      });
      continue;
    }
    if (t.amount < 0) {
      let toCover = Math.abs(t.amount);
      const consumed: TraceSource[] = [];
      while (toCover > 0.001 && queue.length > 0) {
        const head = queue[0];
        const take = Math.min(toCover, head.remaining);
        consumed.push({
          txId: head.txId,
          date: head.date,
          description: head.description,
          merchant: head.merchant,
          amount: take,
          totalInflow: head.originalAmount,
          isInternal: head.isInternal,
          counterpartyAccountId: head.counterpartyAccountId,
          incomeSource: head.incomeSource,
          category: head.category,
        });
        head.remaining -= take;
        toCover -= take;
        if (head.remaining < 0.001) queue.shift();
      }
      if (t.id === target.id) {
        if (toCover > 0.001) {
          notes.push(
            `${toCover.toFixed(2)} could not be traced — the account had no recorded inflows to cover this. Earlier balance from before the first import?`
          );
        }
        if (consumed.some((c) => c.isInternal)) {
          notes.push(
            'Some funding came from an internal transfer. Click into that transfer on the source account to trace one level deeper.'
          );
        }
        return { target: targetSummary, sources: consumed, uncovered: toCover, notes };
      }
    }
  }

  return { target: targetSummary, sources: [], uncovered: Math.abs(target.amount), notes };
}
