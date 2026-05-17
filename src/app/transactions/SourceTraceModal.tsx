'use client';

import { useEffect, useState } from 'react';
import { X, ArrowDownToLine, Repeat2, AlertCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { ENTITY_COLORS, ENTITY_LABELS, getAccount } from '@/constants/accounts';
import { fmtMoney, fmtDate } from '@/lib/format';
import type { EntityType } from '@/types';
import Portal from '@/components/Portal';

interface TraceSource {
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

interface ClearingInflow {
  txId: string;
  date: string;
  description: string;
  merchant: string | null;
  amount: number;
  incomeSource: string | null;
}

interface TraceResult {
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

const SOURCE_LABEL: Record<string, string> = {
  SPACETEL: 'Spacetel wire',
  OMAR_ALGHAZALI: 'Omar Alghazali (Spacetel?)',
  TCETRA: 'TCETRA payout',
  VIDAPAY: 'Vidapay payout',
  STRIPE: 'Stripe',
  DOORDASH: 'DoorDash',
  GRUBHUB: 'Grubhub',
  UBER_EATS: 'Uber Eats',
  GUSTO: 'Gusto refund',
  ZELLE_IN: 'Zelle inbound',
  WIRE_UNKNOWN: 'Wire (unknown sender)',
  OTHER: 'Other inflow',
};

export default function SourceTraceModal({ txId, onClose }: { txId: string; onClose: () => void }) {
  const [data, setData] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/flow/source?txId=${encodeURIComponent(txId)}`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`http_${r.status}`);
        return r.json();
      })
      .then((d: TraceResult) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => { if (!cancelled) setErr(e.message || 'failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [txId]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const target = data?.target;
  const acct = target ? getAccount(target.accountId) : null;
  const entity = (target?.confirmedEntity || target?.entityTag) as EntityType | undefined;
  const counter = target?.counterpartyAccountId ? getAccount(target.counterpartyAccountId) : null;

  const totalAttributed = data ? data.sources.reduce((s, x) => s + x.amount, 0) : 0;

  return (
    <Portal>
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="absolute top-0 right-0 bottom-0 w-[min(560px,100vw)] bg-bg-1 border-l border-line flex flex-col shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 bg-bg-1 border-b border-line px-5 py-3 flex items-center justify-between">
          <div className="text-sm font-medium">Source trace</div>
          <button onClick={onClose} className="text-ink-mute hover:text-ink p-1"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? <div className="text-sm text-ink-mute">Tracing…</div> : null}
          {err ? <div className="text-sm text-flag-critText">Failed to trace: {err}</div> : null}

          {target ? (
            <>
              {/* Target tx summary */}
              <div className="card p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{target.merchant || target.description.slice(0, 80)}</div>
                    <div className="text-[11px] text-ink-mute mt-1">{target.description}</div>
                  </div>
                  <div className={`mono tabnum text-xl ${target.amount > 0 ? 'text-income' : 'text-expense'}`}>
                    {fmtMoney(target.amount)}
                  </div>
                </div>
                <div className="text-[11px] text-ink-dim flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-line">
                  <span>📅 {fmtDate(target.postingDate)}</span>
                  <span>
                    Paid from <span className="mono">···{target.accountId}</span>
                    {acct ? ` (${acct.label})` : ''}
                  </span>
                  {entity ? (
                    <span className="inline-flex items-center gap-1">
                      Books to
                      <span
                        className="pill text-[10px]"
                        style={{
                          background: `${ENTITY_COLORS[entity]}1f`,
                          color: ENTITY_COLORS[entity],
                          border: `1px solid ${ENTITY_COLORS[entity]}40`,
                        }}
                      >
                        {ENTITY_LABELS[entity]}
                      </span>
                    </span>
                  ) : null}
                  {target.isInternal && counter ? (
                    <span className="inline-flex items-center gap-1">
                      <Repeat2 size={11} className="text-warn" />
                      Internal transfer between ···{target.accountId} and ···{counter.id}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Sources */}
              {target.amount >= 0 ? (
                <div className="card p-4">
                  <div className="text-sm">This is an inflow — it IS the source. Where did the sender send it from? That depends on whoever owns <span className="mono">···{target.accountId}</span>&apos;s upstream activity.</div>
                </div>
              ) : data && data.sources.length === 0 ? (
                <div className="card p-4 text-sm text-ink-mute">
                  No prior inflows found on this account to attribute against.
                </div>
              ) : data ? (
                <div>
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-ink-mute mb-2">
                    <span className="inline-flex items-center gap-1.5">
                      <ArrowDownToLine size={12} className="text-income" />
                      Where this money came from (FIFO trace)
                    </span>
                    <span className="mono tabnum">Traced {fmtMoney(totalAttributed)}</span>
                  </div>
                  <div className="card divide-y divide-line/60 overflow-hidden">
                    {data.sources.map((s, i) => (
                      <SourceNode key={`${s.txId}-${i}`} source={s} targetAmount={target.amount} depth={0} />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Cleared-by section */}
              {data && data.clearedBy && data.clearedBy.length > 0 ? (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2 inline-flex items-center gap-1.5">
                    <ArrowDownToLine size={12} className="text-warn" />
                    This made the account negative — cleared by
                  </div>
                  <div className="card divide-y divide-line/60 overflow-hidden">
                    {data.clearedBy.map((c) => (
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

              {data && data.uncovered > 0.01 ? (
                <div className="rounded-md p-3 bg-flag-critBg/30 border border-flag-critText/30 text-xs">
                  <div className="inline-flex items-center gap-1.5 text-flag-critText font-medium mb-1">
                    <AlertCircle size={12} /> Untraced: {fmtMoney(data.uncovered)}
                  </div>
                  <div className="text-ink-dim">
                    This much couldn&apos;t be linked to an imported inflow on this account. Most likely the funds came from a balance that existed before your earliest CSV import.
                  </div>
                </div>
              ) : null}

              {data && data.notes.length > 0 ? (
                <div className="text-[11px] text-ink-mute space-y-1">
                  {data.notes.map((n, i) => <div key={i}>· {n}</div>)}
                </div>
              ) : null}

              <div className="border-t border-line pt-3">
                <Link
                  href={`/transactions?account=${target.accountId}&order=oldest`}
                  className="btn btn-ghost text-xs"
                >
                  <ExternalLink size={12} /> Open full statement for ···{target.accountId}
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
    </Portal>
  );
}

function SourceNode({ source, targetAmount, depth }: { source: TraceSource; targetAmount: number; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1); // auto-expand level 0 internal transfers
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
