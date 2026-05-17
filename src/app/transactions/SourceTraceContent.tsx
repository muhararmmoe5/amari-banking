'use client';

import { useEffect, useState } from 'react';
import { ArrowDownToLine, Repeat2, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { getAccount } from '@/constants/accounts';
import { fmtMoney, fmtDate } from '@/lib/format';
import { SOURCE_LABEL } from '@/lib/source-labels';
export { SOURCE_LABEL };

export interface TraceSource {
  txId: string;
  accountId: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  totalInflow: number;
  isInternal: boolean;
  counterpartyAccountId: string | null;
  incomeSource: string | null;
  category: string;
  upstream?: TraceResult | null;
}

export interface ClearingInflow {
  txId: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  incomeSource: string | null;
}

export interface TraceResult {
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
  clearedBy?: ClearingInflow[];
}

/**
 * Renders the recursive FIFO source trace for a single transaction.
 * Used both inline inside the transaction detail drawer and inside the standalone modal.
 */
export default function SourceTraceContent({ txId, compact = false }: { txId: string; compact?: boolean }) {
  const [data, setData] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`/api/flow/source?txId=${encodeURIComponent(txId)}`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`http_${r.status}`);
        return r.json();
      })
      .then((d: TraceResult) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setErr(e?.message || 'failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [txId]);

  if (loading) {
    return (
      <div className="card p-4 text-xs text-ink-mute inline-flex items-center gap-2">
        <Loader2 size={12} className="animate-spin" />
        Tracing where this money came from…
      </div>
    );
  }
  if (err) {
    return <div className="card p-4 text-xs text-flag-critText">Couldn&apos;t trace: {err}</div>;
  }
  if (!data) {
    return <div className="card p-4 text-xs text-ink-mute">No trace data.</div>;
  }
  const { target, sources, uncovered, clearedBy, notes } = data;

  if (target.amount >= 0) {
    return (
      <div className="card p-4 text-xs">
        This is an inflow — it <strong>is</strong> the source. Where it came from depends on whoever sent it.
      </div>
    );
  }

  const totalAttributed = sources.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-3">
      {/* Sources tree */}
      {sources.length > 0 ? (
        <div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-ink-mute mb-2">
            <span className="inline-flex items-center gap-1.5">
              <ArrowDownToLine size={12} className="text-income" />
              Where this money came from {!compact ? '(FIFO trace, recursive across accounts)' : ''}
            </span>
            <span className="mono tabnum">Traced {fmtMoney(totalAttributed)}</span>
          </div>
          <div className="card divide-y divide-line/60 overflow-hidden">
            {sources.map((s, i) => (
              <SourceNode key={`${s.txId}-${i}`} source={s} targetAmount={target.amount} depth={0} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-3 text-xs text-ink-mute">
          No prior inflows found on this account to attribute against.
        </div>
      )}

      {/* Untraced warning */}
      {uncovered > 0.01 ? (
        <div className="rounded-md p-3 bg-flag-critBg/30 border border-flag-critText/30 text-xs">
          <div className="inline-flex items-center gap-1.5 text-flag-critText font-medium mb-1">
            <AlertCircle size={12} /> Untraced: {fmtMoney(uncovered)}
          </div>
          <div className="text-ink-dim">
            This much couldn&apos;t be linked to an imported inflow on this account. Most likely the funds came from a balance that existed before your earliest CSV import.
          </div>
        </div>
      ) : null}

      {/* Cleared-by */}
      {clearedBy && clearedBy.length > 0 ? (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2 inline-flex items-center gap-1.5">
            <ArrowDownToLine size={12} className="text-warn" />
            This made the account negative — cleared by
          </div>
          <div className="card divide-y divide-line/60 overflow-hidden">
            {clearedBy.map((c) => (
              <div key={c.txId} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {c.merchant || c.description.slice(0, 80)}
                    {c.incomeSource ? (
                      <span className="ml-2 pill text-[10px] bg-income/10 text-income border border-income/30">
                        {SOURCE_LABEL[c.incomeSource] || c.incomeSource}
                      </span>
                    ) : null}
                  </div>
                  <div className="mono tabnum text-income">{fmtMoney(c.amount)}</div>
                </div>
                <div className="text-[11px] text-ink-mute mt-1">📅 {fmtDate(c.date)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div className="text-[11px] text-ink-mute space-y-1">
          {notes.map((n, i) => <div key={i}>· {n}</div>)}
        </div>
      ) : null}
    </div>
  );
}

function SourceNode({ source, targetAmount, depth }: { source: TraceSource; targetAmount: number; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const pct = (source.amount / Math.abs(targetAmount)) * 100;
  const counterAcct = source.counterpartyAccountId ? getAccount(source.counterpartyAccountId) : null;
  const indent = depth * 12;
  const hasUpstream = !!(source.isInternal && source.upstream);
  const upstream = source.upstream;
  const upstreamTraced = upstream && upstream.sources.length > 0;

  return (
    <div className="p-3" style={{ paddingLeft: 12 + indent }}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium min-w-0">
          {hasUpstream ? (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-ink-mute hover:text-ink mr-1.5 inline-block"
            >
              {expanded ? '▾' : '▸'}
            </button>
          ) : null}
          <span className="truncate">{source.merchant || source.description.slice(0, 80)}</span>
          {source.incomeSource ? (
            <span className="ml-2 pill text-[10px] bg-income/10 text-income border border-income/30">
              {SOURCE_LABEL[source.incomeSource] || source.incomeSource}
            </span>
          ) : null}
          {source.isInternal ? (
            <span className="ml-2 pill text-[10px] bg-warn/10 text-warn border border-warn/30 inline-flex items-center gap-1">
              <Repeat2 size={10} /> from ···{source.counterpartyAccountId}{counterAcct ? ` (${counterAcct.label})` : ''}
            </span>
          ) : null}
        </div>
        <div className="text-right shrink-0">
          <div className="mono tabnum text-income">{fmtMoney(source.amount)}</div>
          <div className="text-[10px] text-ink-mute">{pct.toFixed(1)}% of expense</div>
        </div>
      </div>
      <div className="text-[11px] text-ink-mute mt-1 flex flex-wrap items-center gap-2">
        <span>📅 {fmtDate(source.date)}</span>
        <span>· Originally {fmtMoney(source.totalInflow)}</span>
      </div>
      <div className="h-1 bg-bg-2 rounded mt-2 overflow-hidden">
        <div className="h-full bg-income" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>

      {expanded && hasUpstream && upstream ? (
        <div className="mt-3 pl-3 border-l-2 border-warn/40 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-warn flex items-center gap-1">
            <Repeat2 size={10} /> Upstream on ···{source.counterpartyAccountId}{counterAcct ? ` · ${counterAcct.label}` : ''}
          </div>
          {upstreamTraced ? (
            upstream.sources.map((sub, j) => (
              <SourceNode key={`${sub.txId}-${j}`} source={sub} targetAmount={source.amount} depth={depth + 1} />
            ))
          ) : (
            <div className="text-[11px] text-ink-mute italic">
              {upstream.uncovered > 0.01
                ? `Untraced upstream: ${fmtMoney(upstream.uncovered)} — likely from a pre-import balance on that account.`
                : 'No upstream sources found.'}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
