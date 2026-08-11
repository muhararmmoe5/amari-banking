'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ExternalLink, Check } from 'lucide-react';
import type { InflowEvent } from '@/lib/db/queries';
import { getAccount, ENTITY_COLORS } from '@/constants/accounts';
import { fmtMoney } from '@/lib/format';
import { saveCustomSourceTagAction } from '../transactions/actions';

interface DownstreamConsumer {
  txId: string;
  postingDate: string;
  description: string;
  merchant: string | null;
  expenseAmount: number;
  amountFromThisInflow: number;
  pctOfThisInflow: number;
  confirmedEntity: string | null;
  category: string;
  customSourceTag: string | null;
  accountId: string;
}

interface DownstreamResult {
  totalSpent: number;
  remaining: number;
  pctSpent: number;
  consumers: DownstreamConsumer[];
}

export default function FlowList({ inflows }: { inflows: InflowEvent[] }) {
  if (inflows.length === 0) {
    return (
      <div
        style={{
          padding: 40, textAlign: 'center',
          border: '0.5px dashed rgba(255,255,255,0.08)', borderRadius: 12,
          color: 'var(--ink-3)',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>No inflows match these filters</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Try lowering min amount or widening the date range.</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {inflows.map((i) => <InflowRow key={i.id} inflow={i} />)}
    </div>
  );
}

function InflowRow({ inflow }: { inflow: InflowEvent }) {
  const [open, setOpen] = useState(false);
  const [downstream, setDownstream] = useState<DownstreamResult | null>(null);
  const [loading, setLoading] = useState(false);
  const acct = getAccount(inflow.accountId);

  async function toggle() {
    if (!open && downstream == null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/flow/downstream?txId=${inflow.id}`);
        const data = await res.json();
        if (data && Array.isArray(data.consumers)) {
          setDownstream({
            totalSpent: data.totalSpent,
            remaining: data.remaining,
            pctSpent: data.pctSpent,
            consumers: data.consumers,
          });
        } else {
          setDownstream({ totalSpent: 0, remaining: inflow.amount, pctSpent: 0, consumers: [] });
        }
      } catch {
        setDownstream({ totalSpent: 0, remaining: inflow.amount, pctSpent: 0, consumers: [] });
      } finally {
        setLoading(false);
      }
    }
    setOpen((o) => !o);
  }

  return (
    <div
      style={{
        borderRadius: 10, overflow: 'hidden',
        background: 'var(--bg-1, #111114)',
        border: '1px solid ' + (open
          ? 'color-mix(in oklab, var(--income) 30%, rgba(255,255,255,0.06))'
          : 'rgba(255,255,255,0.06)'),
      }}
    >
      {/* Inflow header */}
      <div
        style={{
          padding: '14px 16px',
          display: 'grid',
          gridTemplateColumns: '20px 1fr auto auto',
          gap: 12, alignItems: 'center',
          borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={open ? 'collapse' : 'expand'}
          style={{ background: 'transparent', border: 0, color: 'var(--ink-3)', cursor: 'pointer', padding: 0 }}
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 9, textTransform: 'uppercase', letterSpacing: '.14em',
                color: 'var(--income)', fontWeight: 600,
              }}
            >
              INFLOW · {inflow.postingDate}
            </span>
            {acct ? (
              <span
                style={{
                  fontSize: 9, padding: '1px 7px', borderRadius: 999,
                  background: `${ENTITY_COLORS[acct.entity]}22`,
                  color: ENTITY_COLORS[acct.entity],
                  border: `0.5px solid ${ENTITY_COLORS[acct.entity]}55`,
                }}
              >
                ····{acct.last4}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }} className="truncate">
            {inflow.merchantName || inflow.description.slice(0, 60)}
          </div>
          <InlineTagEditor
            txId={inflow.id}
            initialValue={inflow.customSourceTag}
            placeholder="+ Add custom source tag (e.g. Bytes AI investor wire — Omar tranche 2)"
          />
        </div>

        <div className="num" style={{ fontSize: 20, fontWeight: 500, color: 'var(--income)', textAlign: 'right' }}>
          +{fmtMoney(inflow.amount)}
        </div>

        <Link
          href={`/transactions/${inflow.id}`}
          title="Full detail"
          style={{
            color: 'var(--ink-3)', textDecoration: 'none',
            padding: 4, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
          }}
        >
          Detail <ExternalLink size={11} />
        </Link>
      </div>

      {/* Expanded downstream section */}
      {open ? (
        loading ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
            Tracing where this money went…
          </div>
        ) : downstream ? (
          <DownstreamPanel downstream={downstream} inflowAmount={inflow.amount} />
        ) : null
      ) : null}
    </div>
  );
}

function DownstreamPanel({ downstream, inflowAmount }: { downstream: DownstreamResult; inflowAmount: number }) {
  const pct = Math.min(100, Math.max(0, downstream.pctSpent));
  return (
    <div style={{ padding: '14px 16px 16px' }}>
      {/* Summary bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 6 }}>
          <span className="num" style={{ color: 'var(--gold)', fontWeight: 600 }}>{fmtMoney(downstream.totalSpent)}</span>
          spent of <span className="num">{fmtMoney(inflowAmount)}</span>
          <span style={{ marginLeft: 'auto' }}>
            {pct >= 99.5 ? 'Fully allocated' : `${fmtMoney(downstream.remaining)} still available on this account`}
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: `${pct}%`,
              background: 'linear-gradient(90deg, color-mix(in oklab, var(--gold) 60%, transparent), var(--gold))',
            }}
          />
        </div>
      </div>

      {/* Consumers */}
      {downstream.consumers.length === 0 ? (
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', textAlign: 'center', padding: 12 }}>
          No downstream expenses yet — this inflow is still fully available.
        </div>
      ) : (
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 8,
          }}
        >
          {downstream.consumers.slice(0, 20).map((c, idx) => (
            <ConsumerRow
              key={c.txId}
              consumer={c}
              isLast={idx === Math.min(downstream.consumers.length, 20) - 1}
            />
          ))}
          {downstream.consumers.length > 20 ? (
            <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--ink-3)' }}>
              + {downstream.consumers.length - 20} more not shown
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ConsumerRow({ consumer, isLast }: { consumer: DownstreamConsumer; isLast: boolean }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderBottom: isLast ? 'none' : '0.5px solid rgba(255,255,255,0.045)',
        display: 'grid',
        gridTemplateColumns: '60px 1fr auto auto',
        gap: 12, alignItems: 'center',
      }}
    >
      <div className="num" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
        {consumer.postingDate.slice(5)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 12.5, color: 'var(--ink)' }}>
          {consumer.merchant || consumer.description.slice(0, 50)}
        </div>
        <InlineTagEditor
          txId={consumer.txId}
          initialValue={consumer.customSourceTag}
          placeholder="+ Tag what this spend is (e.g. Bytes AI production API)"
          compact
        />
      </div>
      <div className="num" style={{ fontSize: 12, color: 'var(--gold)', textAlign: 'right' }}>
        {fmtMoney(-consumer.amountFromThisInflow)}
      </div>
      <Link
        href={`/transactions/${consumer.txId}`}
        title="Full detail"
        style={{ color: 'var(--ink-4, #44443f)', display: 'flex', alignItems: 'center' }}
      >
        <ExternalLink size={11} />
      </Link>
    </div>
  );
}

function InlineTagEditor({ txId, initialValue, placeholder, compact }: {
  txId: string;
  initialValue: string | null;
  placeholder: string;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initialValue || '');
  const [saved, setSaved] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'err'>('idle');

  function save(next: string) {
    if (next === (saved || '')) return;
    setStatus('saving');
    startTransition(async () => {
      try {
        await saveCustomSourceTagAction(txId, next || null);
        setSaved(next || null);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 1200);
      } catch {
        setStatus('err');
      }
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: compact ? 3 : 5 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => save(value)}
        onClick={(e) => e.stopPropagation()}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: compact ? '3px 8px' : '5px 10px',
          background: value
            ? 'color-mix(in oklab, var(--gold) 6%, var(--bg-2, #16161a))'
            : 'transparent',
          border: '1px dashed ' + (value
            ? 'color-mix(in oklab, var(--gold) 30%, rgba(255,255,255,0.05))'
            : 'rgba(255,255,255,0.08)'),
          borderRadius: 6,
          fontSize: compact ? 10.5 : 11.5,
          color: value ? 'var(--gold)' : 'var(--ink-3)',
          outline: 'none',
          fontStyle: value ? 'italic' : 'normal',
        }}
      />
      {status === 'saving' || isPending ? (
        <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>saving…</span>
      ) : status === 'saved' ? (
        <span style={{ fontSize: 9, color: 'var(--income)', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Check size={9} /> saved
        </span>
      ) : status === 'err' ? (
        <span style={{ fontSize: 9, color: 'var(--danger, #ff7676)' }}>failed</span>
      ) : null}
    </div>
  );
}
