import Link from 'next/link';
import {
  portfolioSummary,
  summarizeAccounts,
  incomeBySources,
  entityPLs,
  auditRings,
  listTransactions,
  dashboardAlerts,
} from '@/lib/db/queries';
import { ACCOUNTS, ENTITY_COLORS, ENTITY_LABELS } from '@/constants/accounts';
import type { EntityType } from '@/types';
import { Money } from '@/components/Money';
import { EntityBadge } from '@/components/EntityBadge';
import { FlagBadge } from '@/components/FlagBadge';
import Topbar from '@/components/Topbar';
import { periodToDateRange } from '@/lib/period';
import EntityDonut from './EntityDonut';
import AuditRings from './AuditRings';
import AuditQueueActions from './AuditQueueActions';
import { fmtMoney, fmtDate } from '@/lib/format';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const SOURCE_LABELS: Record<string, string> = {
  SPACETEL: 'Spacetel',
  OMAR_ALGHAZALI: 'Omar Alghazali',
  TCETRA: 'TCETRA',
  VIDAPAY: 'Vidapay',
  STRIPE: 'Stripe',
  DOORDASH: 'DoorDash',
  GRUBHUB: 'Grubhub',
  UBER_EATS: 'Uber Eats',
  GUSTO: 'Gusto refund',
  ZELLE_IN: 'Zelle inbound',
  WIRE_UNKNOWN: 'Unknown wires',
  OTHER: 'Other',
};

const ENTITY_ORDER: EntityType[] = [
  'AMARI_VENTURES', 'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'PERSONAL',
  'BYTES_REST_TECH', 'BUSINESS_SHARED', 'MULTI_ENTITY', 'UNKNOWN',
];

export default function DashboardPage({ searchParams }: { searchParams: { period?: string } }) {
  const { from, to } = periodToDateRange(searchParams.period);
  const p = portfolioSummary(from, to);
  const accountSummaries = summarizeAccounts(from, to);
  const incomeSources = incomeBySources(from, to);
  const entities = entityPLs(from, to);
  const rings = auditRings(from, to);
  const topFlagged = listTransactions({ flaggedOnly: true, orderBy: 'audit_score', limit: 8 });
  const alerts = dashboardAlerts(from, to);
  type AlertCard = { key: string; label: string; count: number; tone: 'crit' | 'high' | 'med'; href: string };
  const ALERT_CARDS: AlertCard[] = ([
    { key: 'wires', label: 'Wires needing documentation', count: alerts.criticalWires, tone: 'crit', href: '/audit?sev=crit' },
    { key: 'zelle', label: 'Unclassified Zelle recipients', count: alerts.unclassifiedZelle, tone: 'high', href: '/audit?sev=high&entity=UNKNOWN' },
    { key: 'unkincome', label: 'Unknown income (no source)', count: alerts.unknownIncome, tone: 'high', href: '/audit?sev=high' },
    { key: 'apple', label: 'Apple Cash / PayPal — needs recipient', count: alerts.applePayPayPal, tone: 'high', href: '/audit?sev=high' },
    { key: '1099', label: 'Zelle recipients above $600 (1099)', count: alerts.near1099, tone: 'med', href: '/zelle' },
    { key: 'personal', label: 'Personal-acct outflows >$200', count: alerts.personalOutflows, tone: 'med', href: '/audit?entity=PERSONAL' },
  ] as AlertCard[]).filter((a) => a.count > 0);

  const acctMap = new Map(accountSummaries.map((a) => [a.accountId, a]));
  const reviewPct = p.totalCount > 0 ? Math.round((p.reviewedCount / p.totalCount) * 100) : 0;
  const sourceMax = Math.max(1, ...incomeSources.map((s) => s.total));

  // Group accounts by entity in spec order
  const byEntity = new Map<EntityType, typeof ACCOUNTS>();
  for (const a of ACCOUNTS) {
    const list = byEntity.get(a.entity) || [];
    list.push(a);
    byEntity.set(a.entity, list);
  }

  const noData = p.totalCount === 0;

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="max-w-[1320px] mx-auto px-6 py-6 space-y-6">
        {noData ? (
          <div className="card p-12 text-center">
            <h2 className="text-xl mb-2">No transactions yet</h2>
            <p className="text-ink-dim mb-6">Start by importing one or more Chase CSV exports.</p>
            <Link href="/import" className="btn btn-primary inline-flex">Import your first CSV</Link>
          </div>
        ) : (
          <>
            {/* Alerts strip — only renders if there's something to act on */}
            {ALERT_CARDS.length > 0 ? (
              <section>
                <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-wider text-ink-mute">
                  <AlertTriangle size={12} className="text-warn" />
                  Needs your attention
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {ALERT_CARDS.map((a) => {
                    const colors = {
                      crit: { bg: 'rgba(239,68,68,0.10)', border: '#EF4444', text: '#F87171' },
                      high: { bg: 'rgba(240,160,96,0.10)', border: '#F0A060', text: '#FBBF24' },
                      med:  { bg: 'rgba(245,200,90,0.10)', border: '#FCD34D', text: '#EAB308' },
                    }[a.tone];
                    return (
                      <Link
                        key={a.key}
                        href={a.href}
                        className="rounded-lg p-3 border transition hover:opacity-90"
                        style={{ background: colors.bg, borderColor: `${colors.border}40` }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="mono tabnum text-2xl font-semibold" style={{ color: colors.text }}>{a.count}</div>
                          <ArrowRight size={14} className="text-ink-mute" />
                        </div>
                        <div className="text-[11px] text-ink-dim mt-1 leading-snug">{a.label}</div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Total income" value={fmtMoney(p.totalIncome)} tone="income" />
              <Kpi label="Total expenses" value={fmtMoney(p.totalExpenses)} tone="expense" />
              <Kpi label="Net cash flow" value={fmtMoney(p.net)} tone={p.net >= 0 ? 'income' : 'expense'} accent />
              <Kpi label="Transactions" value={p.totalCount.toLocaleString()} tone="neutral" />
              <Kpi
                label="Audit complete"
                value={`${reviewPct}%`}
                tone="neutral"
                sub={`🔴 ${p.criticalFlagCount} · 🟠 ${p.highFlagCount} · 🟡 ${p.mediumFlagCount}`}
              />
            </div>

            {/* Main 2/3 + 1/3 layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* LEFT: Accounts grouped by entity (rows) */}
              <section className="lg:col-span-2 card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium">All 15 accounts by entity</h2>
                  <Link href="/accounts" className="text-xs text-entity-bytes hover:underline">View all →</Link>
                </div>
                <div className="space-y-4">
                  {ENTITY_ORDER.filter((e) => byEntity.has(e)).map((e) => {
                    const accts = byEntity.get(e)!;
                    return (
                      <div key={e}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: ENTITY_COLORS[e] }} />
                          <span className="text-[11px] uppercase tracking-wider text-ink-dim">{ENTITY_LABELS[e]}</span>
                        </div>
                        <div className="space-y-0.5">
                          {accts.map((a) => {
                            const s = acctMap.get(a.id);
                            const net = s?.net || 0;
                            const trend = net > 0 ? 'up' : net < 0 ? 'down' : 'flat';
                            return (
                              <Link
                                key={a.id}
                                href={`/transactions?account=${a.id}`}
                                className="grid grid-cols-[14px_72px_1fr_120px_28px] items-center gap-3 px-2 py-2 rounded-md hover:bg-bg-2/60 transition"
                              >
                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: ENTITY_COLORS[a.entity] }} />
                                <span className="mono text-xs text-ink-mute">···{a.last4}</span>
                                <span className="text-sm truncate">{a.label}</span>
                                <span className="text-right mono tabnum text-sm">
                                  <Money value={net} />
                                </span>
                                <span className="inline-flex items-center justify-center">
                                  {trend === 'up' ? <TrendingUp size={14} className="text-income" /> :
                                   trend === 'down' ? <TrendingDown size={14} className="text-expense" /> :
                                   <Minus size={14} className="text-ink-mute" />}
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* RIGHT: Donut + sources + rings */}
              <section className="space-y-4">
                <div className="card p-4">
                  <h3 className="text-sm font-medium mb-3">Revenue by entity</h3>
                  <EntityDonut data={entities.map((e) => ({ entity: e.entity, income: e.income }))} />
                </div>

                <div className="card p-4">
                  <h3 className="text-sm font-medium mb-3">Income sources</h3>
                  <div className="space-y-2">
                    {incomeSources.length === 0 ? (
                      <p className="text-ink-mute text-sm">No income yet.</p>
                    ) : (
                      incomeSources.slice(0, 6).map((s) => (
                        <div key={s.source}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-ink-dim">{SOURCE_LABELS[s.source] || s.source}</span>
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

                <div className="card p-4">
                  <h3 className="text-sm font-medium mb-2">Audit progress</h3>
                  <AuditRings data={rings} />
                </div>
              </section>
            </div>

            {/* Audit queue */}
            <section className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium">Audit approval queue</h2>
                <Link href="/audit" className="text-xs text-entity-bytes hover:underline">All {p.openFlagCount} flags →</Link>
              </div>
              {topFlagged.length === 0 ? (
                <p className="text-sm text-ink-mute py-8 text-center">No open flags. Great work 🎉</p>
              ) : (
                <div className="divide-y divide-line/60">
                  {topFlagged.map((t) => (
                    <div key={t.id} className="grid grid-cols-[36px_1fr_140px_120px_120px] items-center gap-3 py-2.5">
                      <FlagBadge score={t.auditScore} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{t.merchantName}</div>
                        <div className="text-[11px] text-ink-mute truncate">···{t.accountId} · {fmtDate(t.postingDate)} · {t.description}</div>
                      </div>
                      <Money value={t.amount} />
                      <EntityBadge entity={t.entityTag} size="xs" />
                      <AuditQueueActions txId={t.id} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Entity P&L cards */}
            <section>
              <h2 className="text-sm font-medium mb-3">Entity P&L</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {entities
                  .filter((e) => ['BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES', 'PERSONAL'].includes(e.entity))
                  .slice(0, 4)
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
    </>
  );
}

function Kpi({ label, value, tone, sub, accent }: { label: string; value: string; tone: 'income' | 'expense' | 'neutral' | 'warn'; sub?: string; accent?: boolean }) {
  const colorMap = { income: 'text-income', expense: 'text-expense', neutral: 'text-ink', warn: 'text-warn' };
  return (
    <div className={`card p-4 ${accent ? 'border-entity-bytes/40' : ''}`}>
      <div className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</div>
      <div className={`mt-2 text-xl font-semibold mono tabnum ${colorMap[tone]}`}>{value}</div>
      {sub ? <div className="text-[11px] text-ink-mute mt-1">{sub}</div> : null}
    </div>
  );
}
