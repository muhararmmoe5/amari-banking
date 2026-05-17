import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { getBudgetDetail } from '@/lib/db/budgets';
import { BUDGET_SUB_KINDS } from '@/lib/budget-kinds';
import { requireOwner } from '@/lib/auth';
import { fmtCents } from '@/lib/cap';
import { fmtDate } from '@/lib/format';
import { getAccount } from '@/constants/accounts';

export const dynamic = 'force-dynamic';

export default function BudgetDetailPage({ params }: { params: { id: string } }) {
  requireOwner();
  const d = getBudgetDetail(params.id);
  if (!d) notFound();

  const b = d.budget;
  const isIncome = b.kind === 'INCOME';
  const primary = isIncome ? d.totalIncomeCents : d.totalExpenseCents;
  const masterPct = d.pctOfMaster;
  const monthlyCap = b.monthlyAmountCents;

  return (
    <div className="p-8 space-y-5 max-w-[1200px]">
      <div>
        <Link href="/budgets" className="inline-flex items-center gap-1 text-xs text-ink-mute hover:text-ink mb-3">
          <ArrowLeft size={12} /> Back to budgets
        </Link>
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          {b.name}
          <span className={`pill text-[10px] ${isIncome ? 'bg-income/10 text-income border border-income/30' : 'bg-expense/10 text-expense border border-expense/30'}`}>{isIncome ? 'income' : 'expense'}</span>
          {b.subKind ? <span className="pill text-[10px] bg-entity-bytes/15 text-entity-bytes border border-entity-bytes/30">{BUDGET_SUB_KINDS[b.subKind]}</span> : null}
        </h1>
        <div className="mt-2 text-[12px] text-ink-dim flex flex-wrap gap-x-4 gap-y-1">
          {b.entity ? <span>📌 Entity: <span className="text-ink">{b.entity.replace(/_/g, ' ').toLowerCase()}</span></span> : null}
          {d.personName ? <span>👤 Person: <span className="text-ink">{d.personName}</span></span> : null}
          {d.commitmentLabel ? <span>↳ Investment: <span className="text-ink">{d.commitmentLabel}</span></span> : null}
        </div>
        {b.notes ? <p className="mt-2 text-sm text-ink-dim">{b.notes}</p> : null}
      </div>

      {/* Master summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <SummaryCard label="Master total" value={b.totalAmountCents ? fmtCents(b.totalAmountCents) : '—'} hint={b.runwayMonths ? `over ${b.runwayMonths} months` : undefined} />
        <SummaryCard
          label={isIncome ? 'Received so far' : 'Spent so far'}
          value={fmtCents(primary)}
          hint={masterPct != null ? `${masterPct.toFixed(1)}% of total` : `${d.txCount} transactions`}
          tone={isIncome ? 'income' : 'expense'}
        />
        <SummaryCard label="Monthly cap" value={monthlyCap ? fmtCents(monthlyCap) : '—'} hint={b.periodMonth ? `targeting ${b.periodMonth}` : 'ongoing'} />
        <SummaryCard
          label={`${d.effectiveMonth} progress`}
          value={fmtCents(isIncome ? d.effectiveMonthIncomeCents : d.effectiveMonthExpenseCents)}
          hint={d.pctOfMonthlyCap != null ? `${d.pctOfMonthlyCap.toFixed(0)}% of monthly cap` : undefined}
        />
      </div>

      {/* Income vs Expense split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard label="Total income tagged" value={fmtCents(d.totalIncomeCents)} tone="income" />
        <SummaryCard label="Total expense tagged" value={fmtCents(d.totalExpenseCents)} tone="expense" />
        <SummaryCard
          label="Net"
          value={fmtCents(d.netCents)}
          tone={d.netCents >= 0 ? 'income' : 'expense'}
          hint={d.netCents >= 0 ? 'positive — money left in the bucket' : 'negative — overspent against incoming'}
        />
      </div>

      {b.totalAmountCents ? (
        <div className="card p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2">Master progress · {fmtCents(primary)} of {fmtCents(b.totalAmountCents)}</div>
          <div className="h-3 bg-bg-2 rounded overflow-hidden">
            <div className={`h-full ${isIncome ? 'bg-income' : 'bg-expense'}`} style={{ width: `${Math.min(100, masterPct || 0)}%` }} />
          </div>
        </div>
      ) : null}

      {/* Monthly breakdown */}
      {d.months.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-dim mb-2">Monthly breakdown</h2>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[120px_1fr_1fr_1fr_80px] text-[11px] text-ink-mute uppercase tracking-wider px-4 py-2 border-b border-line bg-bg-2/30">
              <span>Month</span>
              <span className="text-right">Income</span>
              <span className="text-right">Expense</span>
              <span className="text-right">Net</span>
              <span className="text-right">Tx</span>
            </div>
            {d.months.map((m) => (
              <div key={m.month} className={`grid grid-cols-[120px_1fr_1fr_1fr_80px] px-4 py-2 border-t border-line/40 text-sm items-center ${m.overMonthlyCap ? 'bg-warn/5' : ''}`}>
                <span className="mono">{m.month}{m.overMonthlyCap ? <span className="ml-1 pill text-[9px] bg-warn/20 text-warn border border-warn/40">over cap</span> : null}</span>
                <span className="text-right mono tabnum text-income">{fmtCents(m.incomeCents)}</span>
                <span className="text-right mono tabnum text-expense">{fmtCents(m.expenseCents)}</span>
                <span className={`text-right mono tabnum ${m.netCents >= 0 ? 'text-income' : 'text-expense'}`}>{fmtCents(m.netCents)}</span>
                <span className="text-right text-ink-mute text-xs">{m.txCount}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Transactions list */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-dim mb-2">
          Tagged transactions ({d.transactions.length})
        </h2>
        {d.transactions.length === 0 ? (
          <div className="card p-6 text-sm text-ink-dim">
            No transactions tagged yet. Open any transaction and pick this budget in the &ldquo;Under an existing budget?&rdquo; dropdown.
          </div>
        ) : (
          <div className="card divide-y divide-line/40 overflow-hidden">
            {d.transactions.map((t) => {
              const acct = getAccount(t.accountId);
              const isInflow = t.amountCents > 0;
              return (
                <div key={t.txId} className="p-3 flex items-center gap-3">
                  {isInflow ? <ArrowDownToLine size={14} className="text-income shrink-0" /> : <ArrowUpFromLine size={14} className="text-expense shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{t.merchant || t.description.slice(0, 80)}</div>
                    <div className="text-[11px] text-ink-mute truncate">
                      {fmtDate(t.postingDate)} · ···{t.accountId}{acct ? ` (${acct.label})` : ''}
                    </div>
                  </div>
                  <div className={`mono tabnum text-right shrink-0 ${isInflow ? 'text-income' : 'text-expense'}`}>
                    {fmtCents(t.amountCents)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label, value, hint, tone,
}: { label: string; value: string; hint?: string; tone?: 'income' | 'expense' }) {
  const toneClass = tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : '';
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</div>
      <div className={`mono tabnum text-2xl mt-1 ${toneClass}`}>{value}</div>
      {hint ? <div className="text-[11px] text-ink-mute mt-1">{hint}</div> : null}
    </div>
  );
}
