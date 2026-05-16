'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ArrowDownToLine, ArrowUpFromLine, Repeat2 } from 'lucide-react';
import type { InflowEvent } from '@/lib/db/queries';
import { ENTITY_COLORS, ENTITY_LABELS, getAccount } from '@/constants/accounts';
import { fmtMoney, fmtDate } from '@/lib/format';
import type { EntityType } from '@/types';

const SOURCE_LABELS: Record<string, string> = {
  SPACETEL: 'Spacetel',
  OMAR_ALGHAZALI: 'Omar Alghazali',
  TCETRA: 'TCETRA',
  VIDAPAY: 'Vidapay',
  STRIPE: 'Stripe',
  DOORDASH: 'DoorDash',
  GRUBHUB: 'Grubhub',
  UBER_EATS: 'Uber Eats',
  GUSTO: 'Gusto',
  ZELLE_IN: 'Zelle inbound',
  WIRE_UNKNOWN: 'Wire (unknown)',
  OTHER: 'Other',
};

interface DayRow {
  id: string;
  description: string;
  merchantName: string | null;
  amount: number;
  balanceAfter: number | null;
  isInternal: boolean;
  counterpartyAccountId: string | null;
  category: string;
}

export default function FlowList({ inflows }: { inflows: InflowEvent[] }) {
  if (inflows.length === 0) {
    return (
      <div className="card p-10 text-center text-ink-mute text-sm">
        No inflows match the filters. Try lowering the minimum amount or widening the date range.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {inflows.map((i) => <InflowRow key={i.id} inflow={i} />)}
    </div>
  );
}

function InflowRow({ inflow }: { inflow: InflowEvent }) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<DayRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const acct = getAccount(inflow.accountId);

  async function toggle() {
    if (!open && activity == null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/flow/day?account=${inflow.accountId}&date=${inflow.postingDate}`);
        const data = await res.json();
        setActivity(data.rows || []);
      } catch (e) {
        setActivity([]);
      } finally {
        setLoading(false);
      }
    }
    setOpen((o) => !o);
  }

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full text-left p-4 grid grid-cols-[24px_1fr_180px_140px_140px] items-center gap-3 hover:bg-bg-2/40 transition"
      >
        {open ? <ChevronDown size={16} className="text-ink-mute" /> : <ChevronRight size={16} className="text-ink-mute" />}
        <div className="min-w-0">
          <div className="font-medium">
            {inflow.merchantName || inflow.description.slice(0, 80)}
            {inflow.incomeSource ? (
              <span className="ml-2 pill text-[10px] bg-income/10 text-income border border-income/30">
                {SOURCE_LABELS[inflow.incomeSource] || inflow.incomeSource}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] text-ink-mute truncate">{inflow.description}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: ENTITY_COLORS[inflow.entity as EntityType] || '#888' }} />
          <span className="text-xs">{ENTITY_LABELS[inflow.entity as EntityType] || inflow.entity}</span>
        </div>
        <div className="text-xs text-ink-dim">
          <span className="mono">···{inflow.accountId}</span>
          {acct ? <span className="ml-1 text-ink-mute">· {acct.label}</span> : null}
        </div>
        <div className="text-right mono tabnum text-income text-lg">
          +{fmtMoney(inflow.amount).replace(/^-/, '')}
        </div>
      </button>

      {open ? (
        <div className="border-t border-line bg-bg-0/30 p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2">
            Same-day activity on ···{inflow.accountId} · {fmtDate(inflow.postingDate)}
          </div>
          {loading ? (
            <div className="text-xs text-ink-mute py-3">Loading…</div>
          ) : !activity || activity.length === 0 ? (
            <div className="text-xs text-ink-mute py-3">No same-day activity recorded.</div>
          ) : (
            <DayTrace inflow={inflow} rows={activity} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function DayTrace({ inflow, rows }: { inflow: InflowEvent; rows: DayRow[] }) {
  // Split the day into: this inflow + other inflows + outflows + internal transfers
  const others = rows.filter((r) => r.id !== inflow.id);
  const outflows = others.filter((r) => r.amount < 0 && !r.isInternal);
  const internals = others.filter((r) => r.isInternal);
  const otherInflows = others.filter((r) => r.amount > 0 && !r.isInternal);

  const totalOut = outflows.reduce((s, r) => s + Math.abs(r.amount), 0);
  const totalInternal = internals.filter((r) => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
  const totalOtherIn = otherInflows.reduce((s, r) => s + r.amount, 0);
  const residual = inflow.amount + totalOtherIn - totalOut - totalInternal;

  return (
    <div className="space-y-4">
      {/* Outflows */}
      {outflows.length > 0 ? (
        <Section icon={<ArrowUpFromLine size={12} className="text-expense" />} title={`External outflows (${outflows.length})`} subtitle={`-${fmtMoney(totalOut).replace(/^-/, '')}`}>
          {outflows.map((r) => (
            <FlowLine key={r.id} description={r.description} merchant={r.merchantName} amount={r.amount} note={r.category.replace(/^(EXPENSE_|INCOME_)/, '').replace(/_/g, ' ').toLowerCase()} />
          ))}
        </Section>
      ) : null}

      {/* Internal transfers (money moved to another account) */}
      {internals.length > 0 ? (
        <Section icon={<Repeat2 size={12} className="text-warn" />} title={`Internal transfers (${internals.length})`} subtitle={totalInternal > 0 ? `-${fmtMoney(totalInternal).replace(/^-/, '')} moved out` : ''}>
          {internals.map((r) => {
            const dest = r.counterpartyAccountId ? getAccount(r.counterpartyAccountId) : null;
            return (
              <FlowLine
                key={r.id}
                description={r.description}
                merchant={r.merchantName}
                amount={r.amount}
                note={r.counterpartyAccountId ? `to ···${r.counterpartyAccountId}${dest ? ' (' + dest.label + ')' : ''}` : 'internal'}
                isInternal
              />
            );
          })}
        </Section>
      ) : null}

      {/* Other inflows the same day */}
      {otherInflows.length > 0 ? (
        <Section icon={<ArrowDownToLine size={12} className="text-income" />} title={`Other inflows (${otherInflows.length})`} subtitle={`+${fmtMoney(totalOtherIn).replace(/^-/, '')}`}>
          {otherInflows.map((r) => (
            <FlowLine key={r.id} description={r.description} merchant={r.merchantName} amount={r.amount} />
          ))}
        </Section>
      ) : null}

      {/* Summary */}
      <div className="border-t border-line pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Stat label="This inflow" value={`+${fmtMoney(inflow.amount).replace(/^-/, '')}`} tone="income" />
        <Stat label="Outflows" value={totalOut > 0 ? `-${fmtMoney(totalOut).replace(/^-/, '')}` : '—'} tone="expense" />
        <Stat label="Moved to other accounts" value={totalInternal > 0 ? `-${fmtMoney(totalInternal).replace(/^-/, '')}` : '—'} tone="warn" />
        <Stat label="Net change on day" value={fmtMoney(residual)} tone={residual >= 0 ? 'income' : 'expense'} />
      </div>
    </div>
  );
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-ink-dim font-medium">{icon} {title}</span>
        {subtitle ? <span className="mono tabnum text-ink-dim">{subtitle}</span> : null}
      </div>
      <div className="rounded-md bg-bg-2 divide-y divide-line/60">
        {children}
      </div>
    </div>
  );
}

function FlowLine({ description, merchant, amount, note, isInternal }: { description: string; merchant: string | null; amount: number; note?: string; isInternal?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2">
      <div className="min-w-0">
        <div className="text-sm truncate">{merchant || description.slice(0, 80)}</div>
        {note ? <div className="text-[11px] text-ink-mute">{note}</div> : null}
      </div>
      <div className={`mono tabnum text-sm ${amount > 0 ? 'text-income' : isInternal ? 'text-warn' : 'text-expense'}`}>
        {fmtMoney(amount)}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' | 'warn' | 'neutral' }) {
  const colors = { income: 'text-income', expense: 'text-expense', warn: 'text-warn', neutral: 'text-ink' } as const;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-mute">{label}</div>
      <div className={`mono tabnum font-medium ${colors[tone]}`}>{value}</div>
    </div>
  );
}
