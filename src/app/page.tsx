import Link from 'next/link';
import {
  portfolioSummary,
  summarizeAccounts,
  incomeBySources,
  entityPLs,
  listTransactions,
} from '@/lib/db/queries';
import { ACCOUNTS, ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import { Money } from '@/components/Money';
import { EntityBadge } from '@/components/EntityBadge';
import { FlagBadge } from '@/components/FlagBadge';
import { fmtMoney, fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const SOURCE_LABELS: Record<string, string> = {
  SPACETEL: 'Spacetel',
  OMAR_ALGHAZALI: 'Omar Alghazali (Spacetel?)',
  TCETRA: 'TCETRA',
  VIDAPAY: 'Vidapay',
  STRIPE: 'Stripe',
  DOORDASH: 'DoorDash',
  GRUBHUB: 'Grubhub',
  UBER_EATS: 'Uber Eats',
  GUSTO: 'Gusto',
  ZELLE_IN: 'Zelle inbound',
  WIRE_UNKNOWN: 'Unknown wires',
  OTHER: 'Other',
};

export default function DashboardPage() {
  const p = portfolioSummary();
  const accountSummaries = summarizeAccounts();
  const incomeSources = incomeBySources();
  const entities = entityPLs();
  const topFlagged = listTransactions({ flaggedOnly: true, orderBy: 'audit_score', limit: 8 });

  const acctMap = new Map(accountSummaries.map((a) => [a.accountId, a]));
  const reviewPct = p.totalCount > 0 ? Math.round((p.reviewedCount / p.totalCount) * 100) : 0;
  const sourceMax = Math.max(1, ...incomeSources.map((s) => s.total));

  const noData = p.totalCount === 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-ink-dim mt-1">Portfolio health across all entities and accounts.</p>
        </div>
        <Link href="/import" className="btn btn-primary">⬆ Import CSV</Link>
      </div>

      {noData ? (
        <div className="card p-8 text-center">
          <h2 className="text-xl mb-2">No transactions yet.</h2>
          <p className="text-ink-dim mb-6">Start by importing one or more Chase CSV exports.</p>
          <Link href="/import" className="btn btn-primary inline-flex">⬆ Import your first CSV</Link>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Kpi label="Total income" value={fmtMoney(p.totalIncome)} tone="income" />
            <Kpi label="Total expenses" value={fmtMoney(p.totalExpenses)} tone="expense" />
            <Kpi label="Net cash flow" value={fmtMoney(p.net)} tone={p.net >= 0 ? 'income' : 'expense'} accent />
            <Kpi label="Audit progress" value={`${reviewPct}%`} tone="neutral" sub={`${p.reviewedCount} of ${p.totalCount}`} />
            <Kpi
              label="Open flags"
              value={String(p.openFlagCount)}
              tone="warn"
              sub={`🔴 ${p.criticalFlagCount} · 🟠 ${p.highFlagCount} · 🟡 ${p.mediumFlagCount}`}
            />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Account cards */}
            <section className="lg:col-span-2 space-y-3">
              <h2 className="text-sm uppercase tracking-wider text-ink-dim">All 15 accounts</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {ACCOUNTS.map((acc) => {
                  const s = acctMap.get(acc.id);
                  const net = s?.net || 0;
                  return (
                    <Link href={`/transactions?account=${acc.id}`} key={acc.id} className="card p-4 hover:border-entity-bytes/40 transition">
                      <div
                        className="h-1 -m-4 mb-3 rounded-t-xl"
                        style={{ background: ENTITY_COLORS[acc.entity] }}
                      />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-ink-mute mono">···{acc.last4}</div>
                          <div className="text-sm font-medium mt-0.5">{acc.label}</div>
                        </div>
                        <EntityBadge entity={acc.entity} size="xs" />
                      </div>
                      <div className="mt-3 mono tabnum text-xl">
                        <Money value={net} />
                      </div>
                      <div className="mt-1 text-[11px] text-ink-mute flex items-center justify-between">
                        <span>{s?.count || 0} tx</span>
                        {s?.topIncomeSource ? <span>↗ {SOURCE_LABELS[s.topIncomeSource] || s.topIncomeSource}</span> : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            {/* Right side */}
            <section className="space-y-6">
              <div className="card p-5">
                <h3 className="text-sm uppercase tracking-wider text-ink-dim mb-3">Income sources</h3>
                <div className="space-y-2">
                  {incomeSources.length === 0 ? (
                    <p className="text-ink-mute text-sm">No income detected yet.</p>
                  ) : (
                    incomeSources.map((s) => (
                      <div key={s.source}>
                        <div className="flex items-center justify-between text-sm">
                          <span>{SOURCE_LABELS[s.source] || s.source}</span>
                          <span className="mono tabnum text-income">{fmtMoney(s.total)}</span>
                        </div>
                        <div className="h-1.5 bg-bg-2 rounded mt-1 overflow-hidden">
                          <div className="h-full bg-income" style={{ width: `${(s.total / sourceMax) * 100}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm uppercase tracking-wider text-ink-dim">Audit queue</h3>
                  <Link href="/audit" className="text-xs text-entity-bytes hover:underline">All {p.openFlagCount} →</Link>
                </div>
                <div className="h-1.5 bg-bg-2 rounded mb-3 overflow-hidden">
                  <div className="h-full bg-entity-bytes" style={{ width: `${reviewPct}%` }} />
                </div>
                <div className="space-y-2">
                  {topFlagged.length === 0 ? (
                    <p className="text-ink-mute text-sm">No open flags 🎉</p>
                  ) : (
                    topFlagged.map((t) => (
                      <Link href={`/audit#${t.id}`} key={t.id} className="block py-2 border-t border-line first:border-t-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm truncate">{t.merchantName}</span>
                          <Money value={t.amount} className="text-xs" />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[11px] text-ink-mute">···{t.accountId} · {fmtDate(t.postingDate)}</span>
                          <FlagBadge score={t.auditScore} />
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Entity P&Ls */}
          <section>
            <h2 className="text-sm uppercase tracking-wider text-ink-dim mb-3">Entity P&L</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {entities
                .filter((e) => ['BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES', 'PERSONAL'].includes(e.entity))
                .map((e) => (
                  <div key={e.entity} className="card p-4">
                    <div className="flex items-center justify-between">
                      <EntityBadge entity={e.entity} />
                      <span className={`mono tabnum text-sm ${e.net >= 0 ? 'text-income' : 'text-expense'}`}>{fmtMoney(e.net)}</span>
                    </div>
                    <div className="mt-3 text-xs flex justify-between text-ink-dim">
                      <span>Income</span>
                      <span className="mono text-income">{fmtMoney(e.income)}</span>
                    </div>
                    <div className="text-xs flex justify-between text-ink-dim">
                      <span>Expenses</span>
                      <span className="mono text-expense">{fmtMoney(e.expenses)}</span>
                    </div>
                    {e.topExpenseCategories.length > 0 ? (
                      <div className="mt-3 pt-3 border-t border-line space-y-1">
                        {e.topExpenseCategories.map((c) => (
                          <div key={c.category} className="flex justify-between text-[11px] text-ink-mute">
                            <span className="truncate">{c.category.replace(/^EXPENSE_/, '').replace(/_/g, ' ')}</span>
                            <span className="mono">{fmtMoney(c.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone, sub, accent }: { label: string; value: string; tone: 'income' | 'expense' | 'neutral' | 'warn'; sub?: string; accent?: boolean }) {
  const colorMap = { income: 'text-income', expense: 'text-expense', neutral: 'text-ink', warn: 'text-warn' };
  return (
    <div className={`card p-4 ${accent ? 'border-entity-bytes/40' : ''}`}>
      <div className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</div>
      <div className={`mt-2 text-2xl font-semibold mono tabnum ${colorMap[tone]}`}>{value}</div>
      {sub ? <div className="text-[11px] text-ink-mute mt-1">{sub}</div> : null}
    </div>
  );
}
