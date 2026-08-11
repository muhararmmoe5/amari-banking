import Link from 'next/link';
import { ArrowRight, Wallet, Repeat, TrendingDown, Calendar, AlertCircle, Pause } from 'lucide-react';
import { personalSummary, recurringForecasts } from './personal-data';
import { listTransactions } from '@/lib/db/queries';
import { PageTitle } from '@/components/PageTitle';
import Topbar from '@/components/Topbar';
import { periodToDateRange } from '@/lib/period';
import { fmtDate } from '@/lib/format';
import { requireUser, hasEditAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function fmtMoneyCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(1) + 'K';
  return sign + '$' + abs.toLocaleString();
}
function fmtMoneyFull(n: number): string {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PersonalFinancePage({ searchParams }: { searchParams: { period?: string } }) {
  const user = requireUser();
  if (!hasEditAccess(user)) redirect('/cap');
  const { from, to } = periodToDateRange(searchParams.period);
  const s = personalSummary(from, to);
  const forecasts = recurringForecasts({ personalOnly: true, monthsAhead: 12 });
  const recentTx = listTransactions({
    limit: 12,
    hideInternal: true,
    entityTag: 'PERSONAL',
  });

  const totalMonthlyRecurring = forecasts.reduce((sum, f) => sum + f.monthlyEquivalent, 0);
  const totalAnnualRecurring = forecasts.reduce((sum, f) => sum + f.annualEquivalent, 0);

  // Upcoming forecast instances in the next 30 days
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const upcoming = forecasts
    .flatMap((f) => f.forecast
      .filter((x) => {
        const d = new Date(x.date);
        return d >= now && d <= in30;
      })
      .map((x) => ({ ...x, merchant: f.merchant, label: f.label, frequency: f.frequency, sub: f.subCategory2 || null, txId: f.txId, alertDays: f.alertDays })))
    .sort((a, b) => a.date.localeCompare(b.date));

  const noData = s.txCount === 0;

  return (
    <>
      <Topbar />
      <div className="px-8 pb-12 max-w-[1280px] mx-auto">
        {/* Header */}
        <div className="pt-7 pb-6 flex items-end gap-6">
          <div>
            <PageTitle accent="Per">sonal finance</PageTitle>
            <div className="text-[12.5px] text-ink-mute mt-1">
              {from && to ? (
                <>{new Date(from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(to).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · </>
              ) : (
                <>All time · </>
              )}
              {s.txCount.toLocaleString()} personal transactions
            </div>
          </div>
          <div className="flex-1" />
          <Link href="/transactions?entity=PERSONAL" className="btn btn-sm">
            All personal transactions <ArrowRight size={11} />
          </Link>
        </div>

        {noData ? (
          <div className="card p-12 text-center">
            <h2 className="text-xl mb-2">No personal transactions yet</h2>
            <p className="text-ink-dim text-sm mb-4">Tag transactions as Personal in the drawer (Categorization section) and they&apos;ll show up here.</p>
            <Link href="/transactions" className="btn btn-primary inline-flex">Open transactions</Link>
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <KpiCard label="Personal spend" value={fmtMoneyFull(s.totalExpenses)} hint={`${s.txCount} transactions`} tone="expense" />
              <KpiCard label="Personal income" value={fmtMoneyFull(s.totalIncome)} hint={s.totalIncome > 0 ? 'tagged inflows' : 'no inflows tagged'} tone="income" />
              <KpiCard label="Net" value={fmtMoneyFull(s.net)} hint={s.net >= 0 ? 'in the black' : 'in the red'} tone={s.net >= 0 ? 'income' : 'expense'} />
              <KpiCard
                label="Fixed monthly burn"
                value={fmtMoneyFull(totalMonthlyRecurring)}
                hint={`${forecasts.length} recurring · ${fmtMoneyCompact(totalAnnualRecurring)}/yr`}
                tone="warn"
              />
            </div>

            {/* Recurring forecast — the big one */}
            <RecurringForecastCard forecasts={forecasts} upcoming={upcoming} totalMonthly={totalMonthlyRecurring} totalAnnual={totalAnnualRecurring} />

            {/* Category + person */}
            <div className="grid gap-4 mt-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <CategoryBreakdownCard byCategory={s.byCategory} totalExpenses={s.totalExpenses} />
              <PersonBreakdownCard byPerson={s.byPerson} />
            </div>

            {/* Monthly flow + Recent activity */}
            <div className="grid gap-4 mt-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <MonthlyFlowCard byMonth={s.byMonth} />
              <RecentPersonalCard transactions={recentTx} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ──────────────────── KPI ────────────────────
function KpiCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'income' | 'expense' | 'warn' | 'neutral' }) {
  const toneCls = tone === 'income' ? 'text-income' : tone === 'expense' ? 'text-expense' : tone === 'warn' ? 'text-warn' : '';
  return (
    <div className="card p-4">
      <div className="section-label">{label}</div>
      <div className={`num-display text-2xl mt-2 font-semibold ${toneCls}`}>{value}</div>
      {hint ? <div className="text-[11px] text-ink-mute mt-1.5">{hint}</div> : null}
    </div>
  );
}

// ──────────────────── Recurring Forecast ────────────────────
function RecurringForecastCard({ forecasts, upcoming, totalMonthly, totalAnnual }: {
  forecasts: ReturnType<typeof recurringForecasts>;
  upcoming: Array<{ date: string; amount: number; merchant: string; label: string | null; frequency: string; sub: string | null; txId: string; alertDays: number | null }>;
  totalMonthly: number;
  totalAnnual: number;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="card-head" style={{ cursor: 'default' }}>
        <Repeat size={14} className="text-warn" />
        <div className="flex-1">
          <div className="card-title">Fixed expenses · forecast</div>
          <div className="card-sub">
            {forecasts.length} recurring expenses · projected{' '}
            <span className="num text-warn">{fmtMoneyCompact(totalMonthly)}/mo</span> ·{' '}
            <span className="num text-ink-dim">{fmtMoneyCompact(totalAnnual)}/year</span>
          </div>
        </div>
      </div>

      {forecasts.length === 0 ? (
        <div className="p-6 text-sm text-ink-mute text-center">
          No personal recurring expenses tracked yet. Open a transaction → set <strong className="text-ink">Recurrence & forecast</strong> to <strong className="text-ink">Recurring</strong> and pick a frequency. Every matching transaction will keep this forecast rolling until you turn it off.
        </div>
      ) : (
        <>
          {/* Recurring expenses list */}
          <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 1, background: 'var(--border-subtle)' }}>
            {/* Left: list */}
            <div style={{ background: 'var(--bg-2)' }}>
              <div className="px-5 py-2.5 text-[10px] uppercase tracking-wider text-ink-ghost font-semibold border-b border-line">Active recurring expenses</div>
              <div className="divide-y divide-line/40">
                {forecasts.map((f) => (
                  <Link key={f.txId} href={`/transactions?txId=${f.txId}`} className="block px-5 py-3 hover:bg-bg-3 transition">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate">{f.label || f.merchant}</div>
                        <div className="text-[10.5px] text-ink-mute mt-0.5 flex flex-wrap gap-2">
                          <span className="pill" style={{ background: 'rgba(251,191,36,0.10)', color: 'var(--warn)', borderColor: 'rgba(251,191,36,0.30)' }}>
                            {f.frequency.toLowerCase()}
                          </span>
                          {f.subCategory2 ? <span>· {f.subCategory2}</span> : null}
                          {f.nextDate ? <span>· next {fmtDate(f.nextDate)}</span> : null}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="num text-expense text-[13px] font-semibold">{fmtMoneyFull(-Math.abs(f.amount))}</div>
                        <div className="text-[10.5px] text-ink-mute mt-0.5">{fmtMoneyCompact(f.monthlyEquivalent)}/mo</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: next 30 days */}
            <div style={{ background: 'var(--bg-2)' }}>
              <div className="px-5 py-2.5 text-[10px] uppercase tracking-wider text-ink-ghost font-semibold border-b border-line flex items-center gap-2">
                <Calendar size={11} /> Next 30 days
              </div>
              {upcoming.length === 0 ? (
                <div className="p-5 text-[12px] text-ink-mute italic">No bills coming up in the next 30 days.</div>
              ) : (
                <div className="divide-y divide-line/40">
                  {upcoming.slice(0, 8).map((u, i) => {
                    const daysAway = Math.round((new Date(u.date).getTime() - Date.now()) / (24 * 3600 * 1000));
                    const isUrgent = daysAway <= (u.alertDays || 3);
                    return (
                      <div key={`${u.txId}-${i}`} className="px-5 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-medium truncate">{u.label || u.merchant}</div>
                          <div className="text-[10.5px] text-ink-mute mt-0.5 flex items-center gap-1.5">
                            <span className="num">{fmtDate(u.date)}</span>
                            <span>·</span>
                            <span className={isUrgent ? 'text-warn font-medium' : ''}>
                              {daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`}
                            </span>
                            {isUrgent && <AlertCircle size={10} className="text-warn" />}
                          </div>
                        </div>
                        <div className="num text-expense text-[12.5px] font-semibold">{fmtMoneyFull(-Math.abs(u.amount))}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer hint */}
          <div className="px-5 py-3 border-t border-line text-[11px] text-ink-mute flex items-center gap-2">
            <Pause size={11} />
            Each recurring expense keeps rolling forward until you open the transaction and toggle <strong className="text-ink">Recurring</strong> off.
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────── Category breakdown ────────────────────
function CategoryBreakdownCard({ byCategory, totalExpenses }: { byCategory: Array<{ category: string; total: number; count: number; color: string }>; totalExpenses: number }) {
  return (
    <div className="card">
      <div className="card-head" style={{ cursor: 'default' }}>
        <Wallet size={14} className="text-gold" />
        <div className="flex-1">
          <div className="card-title">Where the money goes</div>
          <div className="card-sub">Top {byCategory.length} categories by spend</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 4 }}>
        {byCategory.length === 0 ? (
          <div className="text-sm text-ink-mute p-3">No expenses to categorize yet.</div>
        ) : (
          <div className="space-y-2.5 pt-3">
            {byCategory.map((c) => {
              const pct = totalExpenses > 0 ? (c.total / totalExpenses) * 100 : 0;
              return (
                <div key={c.category}>
                  <div className="flex justify-between items-baseline text-[12px] mb-1">
                    <span className="truncate flex-1 mr-2">
                      <span className="w-2 h-2 rounded-full inline-block mr-1.5 align-middle" style={{ background: c.color }} />
                      {c.category}
                    </span>
                    <span className="num text-ink-dim shrink-0">{fmtMoneyFull(-c.total)}</span>
                    <span className="num text-ink-mute text-[10.5px] ml-2 shrink-0 w-10 text-right">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 bg-bg-3 rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${Math.min(100, pct)}%`, background: c.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────── Person breakdown ────────────────────
function PersonBreakdownCard({ byPerson }: { byPerson: Array<{ personId: string | null; name: string; total: number; count: number }> }) {
  return (
    <div className="card">
      <div className="card-head" style={{ cursor: 'default' }}>
        <TrendingDown size={14} className="text-purple" />
        <div className="flex-1">
          <div className="card-title">Personal spending by person</div>
          <div className="card-sub">Money paid to / for people tagged as Personal</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 4 }}>
        {byPerson.length === 0 ? (
          <div className="text-sm text-ink-mute p-3">
            No person-tagged personal transactions yet. Open a transaction → set <strong className="text-ink">Counterparty person</strong>.
          </div>
        ) : (
          <div className="divide-y divide-line/40 -mx-4">
            {byPerson.map((p) => (
              <div key={p.personId || p.name} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium truncate">{p.name}</div>
                  <div className="text-[10.5px] text-ink-mute mt-0.5">{p.count} transactions</div>
                </div>
                <div className="num text-expense text-[13px] font-semibold shrink-0">{fmtMoneyFull(-p.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────── Monthly flow ────────────────────
function MonthlyFlowCard({ byMonth }: { byMonth: Array<{ month: string; income: number; expenses: number; net: number }> }) {
  if (byMonth.length === 0) {
    return (
      <div className="card">
        <div className="card-head" style={{ cursor: 'default' }}>
          <div className="flex-1">
            <div className="card-title">Personal cash flow</div>
            <div className="card-sub">Income vs expenses by month</div>
          </div>
        </div>
        <div className="card-body p-6 text-sm text-ink-mute">No monthly data yet.</div>
      </div>
    );
  }

  // Find max for proportional bar heights
  const max = Math.max(...byMonth.flatMap((m) => [m.income, m.expenses]));

  return (
    <div className="card">
      <div className="card-head" style={{ cursor: 'default' }}>
        <div className="flex-1">
          <div className="card-title">Personal cash flow</div>
          <div className="card-sub">Income vs expenses by month</div>
        </div>
      </div>
      <div className="card-body pt-3">
        <div className="space-y-2.5">
          {byMonth.slice(-6).map((m) => (
            <div key={m.month}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-ink-dim num">{m.month}</span>
                <span className={`num ${m.net >= 0 ? 'text-income' : 'text-expense'}`}>
                  {m.net >= 0 ? '+' : ''}{fmtMoneyFull(m.net)}
                </span>
              </div>
              <div className="flex gap-1">
                <div className="flex-1 h-2.5 rounded-sm overflow-hidden bg-bg-3 relative">
                  <div className="h-full bg-income" style={{ width: max > 0 ? `${(m.income / max) * 100}%` : '0%' }} />
                </div>
                <div className="flex-1 h-2.5 rounded-sm overflow-hidden bg-bg-3 relative">
                  <div className="h-full bg-expense" style={{ width: max > 0 ? `${(m.expenses / max) * 100}%` : '0%' }} />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-ink-mute mt-0.5">
                <span>income {fmtMoneyCompact(m.income)}</span>
                <span>spent {fmtMoneyCompact(m.expenses)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────── Recent activity ────────────────────
function RecentPersonalCard({ transactions }: { transactions: any[] }) {
  return (
    <div className="card">
      <div className="card-head" style={{ cursor: 'default' }}>
        <div className="flex-1">
          <div className="card-title">Recent personal transactions</div>
          <div className="card-sub">Last {transactions.length}</div>
        </div>
        <Link href="/transactions?entity=PERSONAL" className="btn btn-ghost btn-sm">All <ArrowRight size={11} /></Link>
      </div>
      {transactions.length === 0 ? (
        <div className="card-body p-6 text-sm text-ink-mute">No personal transactions yet.</div>
      ) : (
        <div className="divide-y divide-line/40">
          {transactions.map((t) => (
            <div key={t.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium truncate">{t.merchantName || t.description.slice(0, 50)}</div>
                <div className="text-[10.5px] text-ink-mute mt-0.5 mono">{fmtDate(t.postingDate)} · ···{t.accountId}</div>
              </div>
              <div className={`num text-[13px] font-semibold shrink-0 ${t.amount >= 0 ? 'text-income' : 'text-expense'}`}>
                {fmtMoneyFull(t.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
