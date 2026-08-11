import 'server-only';
import { getDb } from '@/lib/db';

export interface TraceSource {
  txId: string;
  accountId: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;             // attributed amount in dollars
  totalInflow: number;        // original inflow amount
  isInternal: boolean;
  counterpartyAccountId: string | null;
  incomeSource: string | null;
  category: string;
  /** When this source is an internal transfer, the upstream trace from the source account */
  upstream?: SourceTraceResult | null;
}

export interface ClearingInflow {
  txId: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  incomeSource: string | null;
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
    balanceAfter: number | null;
  };
  sources: TraceSource[];
  uncovered: number;
  notes: string[];
  /** When the target made the account negative, the first inflow(s) that brought it back to zero or positive */
  clearedBy?: ClearingInflow[];
}

const MAX_DEPTH = 2;
const MAX_QUERIES_PER_TRACE = 200;

export function traceAllExpensesOnAccount(
  accountId: string,
  onlyTxIds?: Set<string>
): Map<string, { sources: TraceSource[]; uncovered: number; totalAttributed: number }> {
  const db = getDb();
  const all = db.prepare(`
    SELECT t.id, t.posting_date, t.description, t.merchant_name, t.amount,
      t.is_internal, t.income_source, t.category, t.internal_linked_id,
      linked.account_id as counterparty_account_id
    FROM transactions t
    LEFT JOIN transactions linked ON linked.id = t.internal_linked_id
    WHERE t.account_id = ?
    ORDER BY t.posting_date ASC, t.id ASC
  `).all(accountId) as any[];

  interface InflowSlot {
    txId: string;
    accountId: string;
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
  const out = new Map<string, { sources: TraceSource[]; uncovered: number; totalAttributed: number }>();

  for (const t of all) {
    if (t.amount > 0) {
      queue.push({
        txId: t.id,
        accountId: accountId,
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
          accountId: head.accountId,
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
      if (!onlyTxIds || onlyTxIds.has(t.id)) {
        const totalAttributed = consumed.reduce((s, c) => s + c.amount, 0);
        out.set(t.id, { sources: consumed, uncovered: toCover, totalAttributed });
      }
    }
  }
  return out;
}

export function traceFundingSource(
  txId: string,
  depth: number = 0,
  ctx: { visited: Set<string>; queries: { n: number } } = { visited: new Set(), queries: { n: 0 } }
): SourceTraceResult | null {
  if (ctx.visited.has(txId)) return null;
  ctx.visited.add(txId);
  if (ctx.queries.n++ > MAX_QUERIES_PER_TRACE) return null;
  const db = getDb();
  const target = db.prepare(`
    SELECT id, account_id, posting_date, description, merchant_name, amount, balance,
      is_internal, internal_linked_id, confirmed_entity, entity_tag, category
    FROM transactions WHERE id = ?
  `).get(txId) as any;
  if (!target) return null;

  let counterpartyId: string | null = null;
  if (target.internal_linked_id) {
    const linked = db.prepare(`SELECT account_id FROM transactions WHERE id = ?`).get(target.internal_linked_id) as any;
    if (linked) counterpartyId = linked.account_id;
  }

  const targetSummary: SourceTraceResult['target'] = {
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
    balanceAfter: target.balance,
  };

  const notes: string[] = [];

  if (target.amount >= 0) {
    return { target: targetSummary, sources: [], uncovered: 0, notes };
  }

  // Pull every transaction on this account up to and including the target.
  const all = db.prepare(`
    SELECT t.id, t.posting_date, t.description, t.merchant_name, t.amount,
      t.is_internal, t.income_source, t.category, t.internal_linked_id,
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
    accountId: string;
    date: string;
    description: string;
    merchant: string | null;
    isInternal: boolean;
    internalLinkedId: string | null;
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
        accountId: target.account_id,
        date: t.posting_date,
        description: t.description,
        merchant: t.merchant_name,
        isInternal: !!t.is_internal,
        internalLinkedId: t.internal_linked_id,
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
        const source: TraceSource = {
          txId: head.txId,
          accountId: head.accountId,
          date: head.date,
          description: head.description,
          merchant: head.merchant,
          amount: take,
          totalInflow: head.originalAmount,
          isInternal: head.isInternal,
          counterpartyAccountId: head.counterpartyAccountId,
          incomeSource: head.incomeSource,
          category: head.category,
        };
        // Recursive: if this source is an internal-transfer inflow, walk up through the linked outflow on the source account.
        if (head.isInternal && head.internalLinkedId && depth < MAX_DEPTH) {
          source.upstream = traceFundingSource(head.internalLinkedId, depth + 1, ctx) || null;
        }
        consumed.push(source);
        head.remaining -= take;
        toCover -= take;
        if (head.remaining < 0.001) queue.shift();
      }
      if (t.id === target.id) {
        if (toCover > 0.001) {
          notes.push(
            `${toCover.toFixed(2)} could not be traced — the account had no recorded inflows on this account before this transaction. Likely from a balance that existed before your earliest CSV import.`
          );
        }
        // Look forward for clearing inflow if this transaction made the account negative.
        let clearedBy: ClearingInflow[] | undefined;
        if (target.balance != null && target.balance < 0) {
          const next = db.prepare(`
            SELECT id, posting_date, description, merchant_name, amount, balance, income_source
            FROM transactions
            WHERE account_id = ?
              AND (posting_date > ? OR (posting_date = ? AND id > ?))
            ORDER BY posting_date ASC, id ASC
            LIMIT 50
          `).all(target.account_id, target.posting_date, target.posting_date, target.id) as any[];
          let running = target.balance;
          const cleared: ClearingInflow[] = [];
          for (const r of next) {
            running = r.balance != null ? r.balance : running + r.amount;
            if (r.amount > 0) {
              cleared.push({
                txId: r.id,
                date: r.posting_date,
                description: r.description,
                merchant: r.merchant_name,
                amount: r.amount,
                incomeSource: r.income_source,
              });
            }
            if (running >= 0) break;
          }
          if (cleared.length > 0) clearedBy = cleared;
        }
        return { target: targetSummary, sources: consumed, uncovered: toCover, notes, clearedBy };
      }
    }
  }

  return { target: targetSummary, sources: [], uncovered: Math.abs(target.amount), notes };
}

// Same-day siblings (excluding the target)
export interface SameDayTx {
  id: string;
  description: string;
  merchant: string | null;
  amount: number;
  category: string;
  auditStatus: string;
  confirmedEntity: string | null;
  entityTag: string;
}

// ===== Downstream / forward trace =====
// Given an inflow (income) transaction, walk forward through the same
// account's history and identify every expense that drew (any) portion of
// its remaining balance under FIFO.

export interface DownstreamConsumer {
  txId: string;
  postingDate: string;
  description: string;
  merchant: string | null;
  expenseAmount: number;          // total expense (negative)
  amountFromThisInflow: number;   // how much of this inflow funded that expense
  pctOfThisInflow: number;        // amountFromThisInflow / inflow.amount * 100
  pctOfExpense: number;           // amountFromThisInflow / |expenseAmount| * 100
  confirmedEntity: string | null;
  category: string;
  customSourceTag: string | null;
  accountId: string;
}

export interface DownstreamTraceResult {
  inflow: {
    id: string;
    accountId: string;
    postingDate: string;
    description: string;
    merchant: string | null;
    amount: number;
  };
  consumers: DownstreamConsumer[];
  totalSpent: number;
  remaining: number;
  pctSpent: number;
}

export function traceDownstreamFromInflow(txId: string): DownstreamTraceResult | null {
  const db = getDb();
  const seed = db.prepare(`
    SELECT id, account_id, posting_date, description, merchant_name, amount
    FROM transactions WHERE id = ?
  `).get(txId) as any;
  if (!seed || seed.amount <= 0) return null;

  // Walk every transaction on this account from oldest to newest, replaying FIFO.
  // For each inflow we push it on a queue (with remaining balance). For each
  // outflow we drain from queue head. When the outflow takes some of OUR
  // target inflow's slot, we record it as a consumer.
  const all = db.prepare(`
    SELECT id, posting_date, description, merchant_name, amount, account_id,
      confirmed_entity, entity_tag, category, custom_source_tag
    FROM transactions
    WHERE account_id = ?
    ORDER BY posting_date ASC, id ASC
  `).all(seed.account_id) as any[];

  interface Slot { txId: string; remaining: number; original: number }
  const queue: Slot[] = [];
  const consumers: DownstreamConsumer[] = [];
  for (const t of all) {
    if (t.amount > 0) {
      queue.push({ txId: t.id, remaining: t.amount, original: t.amount });
      continue;
    }
    if (t.amount < 0) {
      let toCover = Math.abs(t.amount);
      while (toCover > 0.001 && queue.length > 0) {
        const head = queue[0];
        const take = Math.min(toCover, head.remaining);
        if (head.txId === txId) {
          consumers.push({
            txId: t.id,
            postingDate: t.posting_date,
            description: t.description,
            merchant: t.merchant_name,
            expenseAmount: t.amount,
            amountFromThisInflow: take,
            pctOfThisInflow: (take / seed.amount) * 100,
            pctOfExpense: (take / Math.abs(t.amount)) * 100,
            confirmedEntity: t.confirmed_entity,
            category: t.category,
            customSourceTag: t.custom_source_tag ?? null,
            accountId: t.account_id,
          });
        }
        head.remaining -= take;
        toCover -= take;
        if (head.remaining < 0.001) queue.shift();
      }
    }
  }

  const totalSpent = consumers.reduce((s, c) => s + c.amountFromThisInflow, 0);
  const remaining = Math.max(0, seed.amount - totalSpent);
  const pctSpent = seed.amount > 0 ? (totalSpent / seed.amount) * 100 : 0;
  return {
    inflow: {
      id: seed.id,
      accountId: seed.account_id,
      postingDate: seed.posting_date,
      description: seed.description,
      merchant: seed.merchant_name,
      amount: seed.amount,
    },
    consumers,
    totalSpent,
    remaining,
    pctSpent,
  };
}

export function getSameDayTransactions(txId: string): SameDayTx[] {
  const db = getDb();
  const target = db.prepare('SELECT account_id, posting_date FROM transactions WHERE id = ?').get(txId) as any;
  if (!target) return [];
  const rows = db.prepare(`
    SELECT id, description, merchant_name, amount, category, audit_status, confirmed_entity, entity_tag
    FROM transactions
    WHERE account_id = ? AND posting_date = ? AND id != ?
    ORDER BY id ASC
  `).all(target.account_id, target.posting_date, txId) as any[];
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    merchant: r.merchant_name,
    amount: r.amount,
    category: r.category,
    auditStatus: r.audit_status,
    confirmedEntity: r.confirmed_entity,
    entityTag: r.entity_tag,
  }));
}
