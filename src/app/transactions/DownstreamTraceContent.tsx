'use client';

import { useEffect, useState } from 'react';
import { ArrowUpFromLine, Loader2, AlertCircle } from 'lucide-react';
import { fmtMoney, fmtDate } from '@/lib/format';
import { ENTITY_LABELS } from '@/constants/accounts';
import type { EntityType } from '@/types';

interface Consumer {
  txId: string;
  postingDate: string;
  description: string;
  merchant: string | null;
  expenseAmount: number;
  amountFromThisInflow: number;
  pctOfThisInflow: number;
  pctOfExpense: number;
  confirmedEntity: string | null;
  category: string;
}
interface Result {
  inflow: { id: string; amount: number; postingDate: string; description: string };
  consumers: Consumer[];
  totalSpent: number;
  remaining: number;
  pctSpent: number;
}

export default function DownstreamTraceContent({ txId }: { txId: string }) {
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`/api/flow/downstream?txId=${encodeURIComponent(txId)}`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`http_${r.status}`);
        return r.json();
      })
      .then((d: Result) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setErr(e?.message || 'failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [txId]);

  if (loading) {
    return (
      <div className="text-2xs text-ink-mute inline-flex items-center gap-2">
        <Loader2 size={12} className="animate-spin" />
        Tracing what this money funded…
      </div>
    );
  }
  if (err) return <div className="text-2xs text-flag-critText">Couldn&apos;t trace: {err}</div>;
  if (!data) return <div className="text-2xs text-ink-mute">No data.</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-2xs text-ink-mute">
          <span className="num-display text-income">{fmtMoney(data.totalSpent)}</span> spent · <span className="num-display text-warn">{fmtMoney(data.remaining)}</span> unallocated
        </div>
        <div className="text-2xs text-ink-mute">{data.pctSpent.toFixed(1)}% used</div>
      </div>
      <div className="h-1.5 bg-bg-2 rounded overflow-hidden">
        <div className="h-full bg-expense" style={{ width: `${Math.min(100, data.pctSpent)}%` }} />
      </div>

      {data.consumers.length === 0 ? (
        <div className="card p-3 text-2xs text-ink-mute italic">
          Nothing has drawn from this inflow yet — the full {fmtMoney(data.inflow.amount)} is still in the account waiting to be spent.
        </div>
      ) : (
        <div className="card divide-y divide-line/40 overflow-hidden">
          {data.consumers.map((c, i) => (
            <div key={`${c.txId}-${i}`} className="p-3 flex items-center gap-3">
              <ArrowUpFromLine size={14} className="text-expense shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{c.merchant || c.description.slice(0, 70)}</div>
                <div className="text-2xs text-ink-mute mt-0.5 flex flex-wrap gap-x-2">
                  <span>{fmtDate(c.postingDate)}</span>
                  {c.confirmedEntity ? <span>· books to {ENTITY_LABELS[c.confirmedEntity as EntityType] || c.confirmedEntity}</span> : null}
                  <span>· {c.pctOfExpense.toFixed(0)}% of the expense</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="num-display text-expense">{fmtMoney(-c.amountFromThisInflow)}</div>
                <div className="text-2xs text-ink-mute">{c.pctOfThisInflow.toFixed(1)}% of inflow</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.remaining > 0.01 ? (
        <div className="rounded-md p-2.5 bg-warn/5 border border-warn/20 text-2xs flex items-start gap-2">
          <AlertCircle size={12} className="text-warn shrink-0 mt-0.5" />
          <span className="text-ink-dim">
            <span className="text-warn font-medium">{fmtMoney(data.remaining)}</span> of this inflow hasn&apos;t been spent yet (still sitting in the account or in a future expense not yet in our data).
          </span>
        </div>
      ) : null}
    </div>
  );
}
