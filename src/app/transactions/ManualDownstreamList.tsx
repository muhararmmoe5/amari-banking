'use client';

import { useEffect, useState } from 'react';
import { Loader2, ArrowUpFromLine } from 'lucide-react';
import { fmtMoney, fmtDate } from '@/lib/format';
import { getAccount, ENTITY_LABELS } from '@/constants/accounts';
import type { EntityType } from '@/types';

interface Expense {
  id: string;
  postingDate: string;
  description: string;
  merchant: string | null;
  amount: number;
  accountId: string;
  confirmedEntity: string | null;
}

/** For inflows: show only the expenses the user has MANUALLY tagged as
 *  funded by this inflow. No FIFO assumption. */
export default function ManualDownstreamList({ inflowTxId, inflowAmount }: { inflowTxId: string; inflowAmount: number }) {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/flow/manual?inflowId=${encodeURIComponent(inflowTxId)}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setExpenses(d.expenses || []); })
      .catch(() => { if (!cancelled) setExpenses([]); });
    return () => { cancelled = true; };
  }, [inflowTxId]);

  if (expenses === null) {
    return (
      <div className="text-2xs text-ink-mute inline-flex items-center gap-2">
        <Loader2 size={12} className="animate-spin" />
        Loading manually-linked expenses…
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="card p-4 text-2xs text-ink-mute italic">
        No expenses tagged as funded by this inflow yet. Open any expense in the transactions list and click <span className="text-ink">Link to income</span> to tag it here.
      </div>
    );
  }

  const totalSpent = expenses.reduce((s, e) => s + Math.abs(e.amount), 0);
  const remaining = Math.max(0, inflowAmount - totalSpent);
  const pct = inflowAmount > 0 ? (totalSpent / inflowAmount) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-2xs">
        <div className="text-ink-mute">
          <span className="num text-expense">{fmtMoney(totalSpent)}</span> tagged · <span className="num text-warn">{fmtMoney(remaining)}</span> unallocated
        </div>
        <div className="text-ink-mute">{pct.toFixed(1)}% used</div>
      </div>
      <div className="h-1.5 bg-bg-2 rounded overflow-hidden">
        <div className="h-full bg-expense" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="card divide-y divide-line/40 overflow-hidden">
        {expenses.map((e) => {
          const acct = getAccount(e.accountId);
          return (
            <div key={e.id} className="p-3 flex items-center gap-3">
              <ArrowUpFromLine size={14} className="text-expense shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{e.merchant || e.description.slice(0, 70)}</div>
                <div className="text-2xs text-ink-mute mt-0.5 flex flex-wrap gap-x-2">
                  <span>{fmtDate(e.postingDate)}</span>
                  <span>· ···{e.accountId}{acct ? ` (${acct.label})` : ''}</span>
                  {e.confirmedEntity ? <span>· books to {ENTITY_LABELS[e.confirmedEntity as EntityType] || e.confirmedEntity}</span> : null}
                </div>
              </div>
              <div className="num text-expense text-sm font-semibold shrink-0">{fmtMoney(e.amount)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
