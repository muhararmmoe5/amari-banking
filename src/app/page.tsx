import Link from 'next/link';
import {
  portfolioSummary,
  summarizeAccounts,
  entityPLs,
  listTransactions,
  dashboardAlerts,
} from '@/lib/db/queries';
import { ENTITY_COLORS, ENTITY_LABELS } from '@/constants/accounts';
import type { EntityType } from '@/types';
import Topbar from '@/components/Topbar';
import { PageTitle } from '@/components/PageTitle';
import { EntityMark } from '@/components/EntityMark';
import { CircleProgress } from '@/components/CircleProgress';
import { Sparkline } from '@/components/Sparkline';
import { CategoryChip } from '@/components/CategoryChip';
import { periodToDateRange } from '@/lib/period';
import { entitySparkData, moneyFlowBuckets, investorCommitments } from './dashboard-data';
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  AlertTriangle,
  GitBranch,
  Flag,
  Calendar,
  Check,
  Filter,
  Tag,
  Download,
  FileText,
} from 'lucide-react';
import { requireUser, hasEditAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const ENTITY_ORDER: EntityType[] = [
  'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES', 'BYTES_REST_TECH', 'AMARI_HOLDINGS',
];

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

export default function DashboardPage({ searchParams }: { searchParams: { period?: string } }) {
  // Full-portfolio dashboard — restricted to editors/owners. Non-editors
  // land on /cap which routes them to their own team page.
  const user = requireUser();
  if (!hasEditAccess(user)) redirect('/cap');
  const { from, to } = periodToDateRange(searchParams.period);
  const p = portfolioSummary(from, to);
  const accountSummaries = summarizeAccounts(from, to);
  const entities = entityPLs(from, to);
  const recentTx = listTransactions({ limit: 10, hideInternal: true });
  const alerts = dashboardAlerts(from, to);
  const spark = entitySparkData();
  const flow = moneyFlowBuckets(from, to);
  const investors = investorCommitments();

  // Compose entity rows from entityPLs + account summaries (balance = sum of account balances)
  const acctByEntity = new Map<EntityType, typeof accountSummaries>();
  for (const a of accountSummaries) {
    const acct = require('@/constants/accounts').ACCOUNTS.find((x: any) => x.id === a.accountId);
    if (!acct) continue;
    const list = acctByEntity.get(acct.entity) || [];
    list.push(a);
    acctByEntity.set(acct.entity, list);
  }

  const entityRows = ENTITY_ORDER.map((id) => {
    const pl = entities.find((e) => e.entity === id);
    const accts = acctByEntity.get(id) || [];
    const balance = accts.reduce((s, a) => s + (a.net || 0), 0);  // net activity in period as a proxy
    return {
      id,
      name: ENTITY_LABELS[id],
      color: ENTITY_COLORS[id],
      balance: balance || 0,
      revenue: pl?.income || 0,
      expenses: pl?.expenses || 0,
      net: pl?.net || 0,
      role: ENTITY_LABELS[id],
    };
  });

  const netCash = p.totalIncome - p.totalExpenses;
  const auditPct = p.totalCount > 0 ? p.reviewedCount / p.totalCount : 0;
  const txTagged = p.reviewedCount;
  const txUntagged = p.totalCount - p.reviewedCount;
  // Rough runway: at the current avg daily burn over the period, how many days can netCash last?
  const days = from && to ? Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / (24 * 3600 * 1000))) : 30;
  const avgDailyBurn = p.totalExpenses / days;
  const runwayDays = avgDailyBurn > 0 ? Math.round(netCash / avgDailyBurn) : 0;

  const noData = p.totalCount === 0;

  // Attention queue — derive from real alert counts
  const attention = [
    alerts.criticalWires > 0 ? { id: 'wires', level: 'urgent', icon: AlertTriangle, title: `${alerts.criticalWires} wires need documentation`, detail: 'Open the audit review queue · oldest first', cta: 'Review', href: '/audit?sev=crit', count: alerts.criticalWires } : null,
    alerts.unclassifiedZelle > 0 ? { id: 'zelle', level: 'urgent', icon: GitBranch, title: `${alerts.unclassifiedZelle} unclassified Zelle recipients`, detail: 'Tag recipients to track 1099 thresholds', cta: 'Open', href: '/audit?sev=high&entity=UNKNOWN', count: alerts.unclassifiedZelle } : null,
    alerts.unknownIncome > 0 ? { id: 'income', level: 'warning', icon: Flag, title: `${alerts.unknownIncome} unknown income items`, detail: 'Tag the source so cap-table progress updates', cta: 'Review', href: '/audit?sev=high', count: alerts.unknownIncome } : null,
    alerts.near1099 > 0 ? { id: '1099', level: 'info', icon: Calendar, title: `${alerts.near1099} Zelle recipients above $600`, detail: 'Cross 1099 threshold — collect W-9 info', cta: 'Open', href: '/zelle' } : null,
    alerts.personalOutflows > 0 ? { id: 'personal', level: 'info', icon: Check, title: `${alerts.personalOutflows} personal outflows > $200`, detail: 'Review for reimbursement / classification', cta: 'Review', href: '/audit?entity=PERSONAL', count: alerts.personalOutflows } : null,
  ].filter(Boolean) as Array<{ id: string; level: 'urgent' | 'warning' | 'info'; icon: any; title: string; detail: string; cta: string; href: string; count?: number }>;

  return (
    <>
      <Topbar />
      {noData ? (
        <div className="px-8 py-24 max-w-2xl mx-auto text-center">
          <div className="card p-12 space-y-4">
            <h2 className="text-2xl font-medium tracking-tight">No transactions yet</h2>
            <p className="text-ink-dim text-sm">Start by importing one or more Chase CSV exports.</p>
            <Link href="/import" className="btn btn-primary inline-flex">Import your first CSV</Link>
          </div>
        </div>
      ) : (
        <div className="px-8 pb-12">
          {/* ────────── 1. Page header ────────── */}
          <div className="pt-7 pb-6 flex items-end gap-6">
            <div>
              <PageTitle accent="Dash">board</PageTitle>
              <div className="text-[12.5px] text-ink-mute mt-1">
                {from && to ? (
                  <>{new Date(from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(to).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · </>
                ) : (
                  <>All time · </>
                )}
                all six entities · {p.totalCount.toLocaleString()} transactions
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex gap-2 items-center">
              {/* Books-up-to-date pill drives from the real review progress
                  — was previously a cosmetic green pill regardless of state. */}
              <span
                className="chip"
                style={{
                  color: p.openFlagCount === 0 ? '#7fb892' : '#c9a87a',
                }}
              >
                <span
                  className="chip-dot"
                  style={{ background: p.openFlagCount === 0 ? '#7fb892' : '#c9a87a', color: p.openFlagCount === 0 ? '#7fb892' : '#c9a87a' }}
                />
                {p.openFlagCount === 0 ? 'Books up to date' : `${p.openFlagCount} open flag${p.openFlagCount === 1 ? '' : 's'}`}
              </span>
              <Link href="/cpa" className="btn btn-ghost btn-sm"><Download size={13} /> CPA export</Link>
              {/* 'Investor update' had no handler — removed until it's a
                  real report generator. */}
              <Link href="/audit" className="btn btn-primary btn-sm"><Tag size={13} /> Tag transactions</Link>
            </div>
          </div>

          {/* ────────── 2. Hero strip ────────── */}
          <div
            className="card overflow-hidden mb-6 grid"
            style={{
              gridTemplateColumns: '1.3fr 1fr 1fr',
              gap: 1,
              background: 'rgba(255,255,255,0.055)',
            }}
          >
            {/* Cell A — Period net (income minus expenses in-period).
                Labeled 'Net for period' to be honest — the previous 'Net
                cash position' label suggested current bank balances,
                which this figure isn't. See /flow for real balances. */}
            <div className="bg-bg-1 p-6">
              <div className="section-label">Net for period</div>
              <div className="flex items-baseline gap-1.5 mt-3.5">
                <span className="serif-display" style={{ fontSize: 52 }}>{fmtMoneyCompact(netCash).replace(/[KM]$/, '').replace('$', '$')}</span>
                <span className="text-[18px] text-ink-dim font-medium">{Math.abs(netCash) >= 1e6 ? 'M' : Math.abs(netCash) >= 1e3 ? 'K' : ''}</span>
              </div>
              <div className="flex gap-3.5 mt-3.5 items-center">
                <span className={`inline-flex items-center gap-1 text-[12.5px] font-medium ${p.net >= 0 ? 'text-income' : 'text-expense'}`}>
                  {p.net >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  <span className="num">{fmtMoneyCompact(p.net)}</span>
                </span>
                <span className="text-[11.5px] text-ink-mute">across {entityRows.length} entities · {accountSummaries.length} accounts</span>
              </div>
              <div className="flex h-1 rounded-sm overflow-hidden mt-4">
                {entityRows.filter((e) => e.balance > 0).map((e) => (
                  <div key={e.id} className="opacity-85" style={{ flex: Math.max(0.1, Math.abs(e.balance)), background: e.color }} title={`${e.name} · ${fmtMoneyCompact(e.balance)}`} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-ink-ghost">
                {entityRows.slice(0, 4).map((e) => {
                  const totalPos = entityRows.reduce((s, x) => s + Math.max(0, x.balance), 0) || 1;
                  const pct = Math.max(0, (e.balance / totalPos) * 100);
                  return <span key={e.id}>{e.name.split(' ')[0]} {pct.toFixed(0)}%</span>;
                })}
              </div>
            </div>

            {/* Cell B — Audit completion */}
            <div className="bg-bg-1 p-6">
              <div className="section-label">Audit completion</div>
              <div className="flex items-center gap-4 mt-3.5">
                <div className="relative w-16 h-16">
                  <CircleProgress pct={auditPct} size={64} color="#c9a87a" trackColor="#1c1c21" />
                  <div className="absolute inset-0 grid place-items-center font-mono text-[13px] font-semibold tracking-tight">
                    {Math.round(auditPct * 100)}%
                  </div>
                </div>
                <div className="flex-1">
                  <div className="serif-display" style={{ fontSize: 36 }}>{txTagged.toLocaleString()}</div>
                  <div className="text-[11.5px] text-ink-mute mt-0.5">of {p.totalCount.toLocaleString()} tagged</div>
                </div>
              </div>
              <div className="flex gap-3.5 mt-3.5 text-[11.5px]">
                <span className="inline-flex items-center gap-1 text-expense">
                  <span className="w-1 h-1 rounded-full bg-expense" />
                  <span className="num">{txUntagged}</span>
                  <span className="text-ink-mute">untagged</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-expense" />
                  <span className="num">{p.openFlagCount}</span>
                  <span className="text-ink-mute">flagged</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full" style={{ background: '#c9a87a' }} />
                  <span className="num">{p.criticalFlagCount}</span>
                  <span className="text-ink-mute">critical</span>
                </span>
              </div>
            </div>

            {/* Cell C — Runway */}
            <div className="bg-bg-1 p-6">
              <div className="section-label">Runway at current burn</div>
              {/* When net cash is negative, showing '-30 days' is worse than
                  saying 'burning cash' — the bar can't go below zero. */}
              {runwayDays < 0 ? (
                <>
                  <div className="flex items-baseline gap-2 mt-3.5">
                    <span className="serif-display" style={{ fontSize: 40, color: '#d18876' }}>Burning</span>
                  </div>
                  <div className="text-[11.5px] text-ink-mute mt-3.5">
                    Net cash negative · <span className="num">${Math.round(avgDailyBurn).toLocaleString()}</span>/day avg burn
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 mt-3.5">
                    <span className="serif-display" style={{ fontSize: 52 }}>{runwayDays > 9999 ? '∞' : runwayDays}</span>
                    <span className="text-[16px] text-ink-dim">days</span>
                  </div>
                  <div className="text-[11.5px] text-ink-mute mt-3.5">
                    ~{Math.max(0, Math.round(runwayDays / 30))} months · <span className="num">${Math.round(avgDailyBurn).toLocaleString()}</span>/day avg burn
                  </div>
                </>
              )}
              <div className="relative h-1.5 bg-bg-3 rounded-sm mt-4">
                <div
                  className="absolute left-0 top-0 h-full rounded-sm"
                  style={{
                    width: `${Math.min(100, Math.max(0, (runwayDays / 730) * 100))}%`,
                    background: 'linear-gradient(90deg, #c9a87a, #88724a)',
                  }}
                />
                {/* 'Now' marker sits at the start of the bar — it was
                    previously pinned at 10% regardless of runway, which
                    misled about how much burn had already happened. */}
                <div className="absolute -top-1 w-0.5 h-3" style={{ left: '0%', background: '#f0eee9' }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-ink-ghost">
                <span>now</span>
                <span>projected zero</span>
              </div>
            </div>
          </div>

          {/* ────────── 3. Entity strip ────────── */}
          <div className="mb-6">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="section-label">Entities</span>
              <span className="text-[11px] text-ink-ghost">· {from && to ? `${new Date(from).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${new Date(to).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'all time'}</span>
              <span className="flex-1" />
              <Link href="/pl" className="btn btn-ghost btn-sm">View all P&Ls <ArrowRight size={11} /></Link>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {entityRows.map((e) => (
                <Link
                  key={e.id}
                  href={`/cap/${e.id}`}
                  className="card hover-lift overflow-hidden block"
                  style={{ padding: 0 }}
                >
                  <div className="h-[3px]" style={{ background: e.color }} />
                  <div className="px-4 py-3.5 pb-4">
                    <div className="flex items-center gap-2">
                      <EntityMark entity={e.id} size={22} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold tracking-tight truncate">{e.name}</div>
                        <div className="text-[10.5px] text-ink-ghost truncate">{e.role}</div>
                      </div>
                    </div>
                    <div className="mt-3.5">
                      <div className="text-[10px] text-ink-ghost uppercase tracking-wider">Net (period)</div>
                      <div className={`num-display text-[18px] leading-tight mt-0.5 ${e.net < 0 ? 'text-expense' : 'text-ink'}`}>
                        {fmtMoneyCompact(e.net)}
                      </div>
                    </div>
                    <div className="my-2.5 -mx-1">
                      <Sparkline data={spark[e.id] || [0, 0]} color={e.color} height={28} />
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-1.5 pt-2.5 border-t border-line">
                      <div>
                        <div className="text-[10px] text-ink-ghost">In</div>
                        <div className="num text-income text-[11.5px] font-medium">{e.revenue ? fmtMoneyCompact(e.revenue) : '—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-ink-ghost">Out</div>
                        <div className="num text-expense text-[11.5px] font-medium">{e.expenses ? fmtMoneyCompact(-e.expenses) : '—'}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* ────────── 4 + 5. Money flow + Investor commitments ────────── */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <MoneyFlow flow={flow} />
            <InvestorCommitmentsCard investors={investors} />
          </div>

          {/* ────────── 6 + 7. Attention + Recent activity ────────── */}
          <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
            <AttentionQueue items={attention} />
            <RecentActivity transactions={recentTx} />
          </div>
        </div>
      )}
    </>
  );
}

// ────────── Money Flow (Sankey-ish) ──────────
function MoneyFlow({ flow }: { flow: { sources: any[]; destinations: any[] } }) {
  const { sources, destinations } = flow;
  const totalIn = sources.reduce((s, x) => s + x.amount, 0) || 1;
  const totalOut = destinations.reduce((s, x) => s + x.amount, 0) || 1;
  const W = 760;
  const H = 320;
  const padY = 20;
  const colW = 56;
  const usableH = H - padY * 2;

  const srcGapTotal = Math.max(0, (sources.length - 1) * 6);
  const srcScaled = usableH - srcGapTotal;
  let srcCum = padY;
  const srcRects = sources.map((s) => {
    const h = (s.amount / totalIn) * srcScaled;
    const rect = { ...s, x: 0, y: srcCum, w: colW, h };
    srcCum += h + 6;
    return rect;
  });

  const dstGapTotal = Math.max(0, (destinations.length - 1) * 6);
  const dstScaled = usableH - dstGapTotal;
  let dstCum = padY;
  const dstRects = destinations.map((d) => {
    const h = (d.amount / totalOut) * dstScaled;
    const rect = { ...d, x: W - colW, y: dstCum, w: colW, h };
    dstCum += h + 6;
    return rect;
  });

  const flows: { path: string; color: string; key: string }[] = [];
  const sCum = sources.map(() => 0);
  const dCum = destinations.map(() => 0);
  sources.forEach((s, i) => {
    const sShare = s.amount / totalIn;
    destinations.forEach((d, j) => {
      const dShare = d.amount / totalOut;
      const bandSrc = sShare * dShare * srcScaled;
      const bandDst = sShare * dShare * dstScaled;
      const y1Top = srcRects[i].y + sCum[i];
      const y1Bot = y1Top + bandSrc;
      const y2Top = dstRects[j].y + dCum[j];
      const y2Bot = y2Top + bandDst;
      const x1 = colW;
      const x2 = W - colW;
      const mid = (x1 + x2) / 2;
      flows.push({
        key: `${i}-${j}`,
        color: s.color,
        path: [
          `M ${x1} ${y1Top}`,
          `C ${mid} ${y1Top}, ${mid} ${y2Top}, ${x2} ${y2Top}`,
          `L ${x2} ${y2Bot}`,
          `C ${mid} ${y2Bot}, ${mid} ${y1Bot}, ${x1} ${y1Bot}`,
          `Z`,
        ].join(' '),
      });
      sCum[i] += bandSrc;
      dCum[j] += bandDst;
    });
  });

  return (
    <div className="card" style={{ minHeight: 420 }}>
      <div className="card-head">
        <div>
          <div className="card-title">Money flow</div>
          <div className="card-sub">Where capital came from and where it went</div>
        </div>
        <div className="flex-1" />
        {/* Segmented tab strip was fake — only 'Sources → Uses' was implemented.
            Replace with a single label so nothing looks clickable that isn't. */}
        <div className="px-2.5 py-1 text-[11.5px] rounded font-medium bg-bg-2 border border-line" style={{ color: '#f0eee9' }}>
          Sources → Uses
        </div>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-3.5 px-6 pt-4 pb-2">
        <div>
          <div className="section-label">Money in</div>
          <div className="serif-display text-income mt-1.5" style={{ fontSize: 28 }}>+{fmtMoneyCompact(totalIn)}</div>
        </div>
        <div className="text-center">
          <div className="section-label">Net flow</div>
          <div className="serif-display mt-1.5" style={{ fontSize: 28 }}>{(totalIn - totalOut) >= 0 ? '+' : '-'}{fmtMoneyCompact(Math.abs(totalIn - totalOut))}</div>
        </div>
        <div className="text-right">
          <div className="section-label">Money out</div>
          <div className="serif-display text-expense mt-1.5" style={{ fontSize: 28 }}>−{fmtMoneyCompact(totalOut)}</div>
        </div>
      </div>

      {/* Sankey */}
      <div className="px-4 pt-2 pb-4 flex gap-3">
        <div className="w-[152px] flex flex-col gap-1.5" style={{ paddingTop: padY }}>
          {srcRects.map((r, i) => (
            <div key={i} className="flex items-center justify-end text-right pr-0.5" style={{ height: r.h }}>
              <div>
                <div className="text-[11.5px] font-medium leading-tight">{r.label}</div>
                <div className="num text-[10.5px] text-ink-mute mt-0.5">{fmtMoneyCompact(r.amount)}</div>
              </div>
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ flex: 1, height: H }} preserveAspectRatio="none">
          <g opacity="0.32">
            {flows.map((f) => (
              <path key={f.key} d={f.path} fill={f.color} />
            ))}
          </g>
          {srcRects.map((r, i) => (
            <rect key={`s-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color} rx="2" />
          ))}
          {dstRects.map((r, i) => (
            <rect key={`d-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color} rx="2" />
          ))}
        </svg>
        <div className="w-[152px] flex flex-col gap-1.5" style={{ paddingTop: padY }}>
          {dstRects.map((r, i) => (
            <div key={i} className="flex items-center pl-0.5" style={{ height: r.h }}>
              <div>
                <div className="text-[11.5px] font-medium leading-tight">{r.label}</div>
                <div className="num text-[10.5px] text-ink-mute mt-0.5">{fmtMoneyCompact(r.amount)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ────────── Investor commitments ──────────
function InvestorCommitmentsCard({ investors }: { investors: any[] }) {
  const totalCommitted = investors.reduce((s, i) => s + i.committed, 0);
  const totalReceived = investors.reduce((s, i) => s + i.received, 0);
  const overallPct = totalCommitted > 0 ? totalReceived / totalCommitted : 0;

  return (
    <div className="card flex flex-col" style={{ minHeight: 420 }}>
      <div className="card-head">
        <div>
          <div className="card-title">Investor commitments</div>
          <div className="card-sub">{investors.length} active investor{investors.length === 1 ? '' : 's'}</div>
        </div>
        <div className="flex-1" />
        <Link href="/cap" className="btn btn-ghost btn-sm"><ArrowRight size={11} /></Link>
      </div>

      <div className="px-6 pt-4 pb-3">
        <div className="flex items-baseline gap-2">
          <span className="serif-display" style={{ fontSize: 34 }}>{fmtMoneyCompact(totalReceived)}</span>
          <span className="text-[12.5px] text-ink-mute">
            of <span className="num text-ink-dim">{fmtMoneyCompact(totalCommitted)}</span> committed
          </span>
        </div>
        <div className="h-1 bg-bg-3 rounded-sm mt-2.5 overflow-hidden">
          <div className="h-full" style={{ width: `${overallPct * 100}%`, background: '#c9a87a' }} />
        </div>
        <div className="flex justify-between text-[11px] text-ink-mute mt-1.5">
          <span>{Math.round(overallPct * 100)}% received</span>
          <span className="num">{fmtMoneyCompact(totalCommitted - totalReceived)} pending</span>
        </div>
      </div>

      <div className="border-t border-line flex-1">
        {investors.length === 0 ? (
          <div className="p-6 text-center text-sm text-ink-mute">
            No active investor commitments yet. <Link href="/cap" className="text-accent hover:underline" style={{ color: '#c9a87a' }}>Record one →</Link>
          </div>
        ) : investors.slice(0, 5).map((inv: any, i: number) => {
          const pct = inv.committed > 0 ? inv.received / inv.committed : 0;
          const entColor = ENTITY_COLORS[inv.entity as EntityType] || '#6f6e68';
          return (
            <div
              key={inv.id}
              className="grid gap-3 px-6 py-3"
              style={{ gridTemplateColumns: '1fr auto', borderBottom: i < Math.min(investors.length, 5) - 1 ? '1px solid rgba(255,255,255,0.055)' : 'none' }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium">{inv.name}</span>
                  <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-mute">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: entColor }} />
                    {ENTITY_LABELS[inv.entity as EntityType]}
                  </span>
                </div>
                <div className="h-[3px] bg-bg-3 rounded-sm mt-2 overflow-hidden" style={{ maxWidth: 200 }}>
                  <div className="h-full" style={{ width: `${pct * 100}%`, background: entColor }} />
                </div>
              </div>
              <div className="text-right">
                <div className="num text-[12.5px] font-medium">
                  {fmtMoneyCompact(inv.received)} <span className="text-ink-mute">/ {fmtMoneyCompact(inv.committed)}</span>
                </div>
                <div className="text-[10.5px] text-ink-ghost mt-0.5">
                  {inv.equityPct != null ? `${inv.equityPct.toFixed(1)}% equity` : '—'}
                  {inv.lastWireDate ? ` · last wire ${new Date(inv.lastWireDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────── Attention queue ──────────
function AttentionQueue({ items }: { items: any[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Needs attention</div>
          <div className="card-sub">{items.length} item{items.length === 1 ? '' : 's'} · sorted by urgency</div>
        </div>
        <div className="flex-1" />
        {/* 'Clear done' was dead; removed until we build a real bulk-dismiss.
            Same for 'Filter' in Recent activity below. */}
      </div>
      <div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-mute">
            All clear ✨
          </div>
        ) : items.map((item) => {
          const Icon = item.icon;
          const levelColor = item.level === 'urgent' ? '#d18876' : item.level === 'warning' ? '#f2b96d' : '#6f6e68';
          return (
            <Link
              key={item.id}
              href={item.href}
              className="hover-lift grid gap-3.5 items-center px-5 py-3.5 border-b border-line cursor-pointer last:border-b-0"
              style={{ gridTemplateColumns: 'auto 1fr auto' }}
            >
              <div className="w-8 h-8 grid place-items-center rounded-lg bg-bg-2 border border-line" style={{ color: levelColor }}>
                <Icon size={15} />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-medium">{item.title}</span>
                  {item.count != null ? (
                    <span className="num px-1.5 py-px rounded-full bg-bg-3 text-[10.5px] text-ink-dim font-medium">
                      {item.count}
                    </span>
                  ) : null}
                </div>
                <div className="text-[11.5px] text-ink-mute mt-0.5">{item.detail}</div>
              </div>
              {/* Was <button> nested inside <Link> — invalid HTML with
                  browsers making inconsistent click decisions. Turned into
                  a plain span so only the outer Link handles the click. */}
              <span className="btn btn-sm pointer-events-none">
                {item.cta} <ArrowRight size={11} />
              </span>
            </Link>
          );
        })}
        <div className="px-5 py-3 text-center">
          <Link href="/audit" className="btn btn-ghost btn-sm">View all <ArrowRight size={11} /></Link>
        </div>
      </div>
    </div>
  );
}

// ────────── Recent activity ──────────
function RecentActivity({ transactions }: { transactions: any[] }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Recent activity</div>
          <div className="card-sub">Last {transactions.length} transactions across all accounts</div>
        </div>
        <div className="flex-1" />
        {/* 'Filter' was dead; the transactions list has real filters. */}
        <Link href="/transactions" className="btn btn-ghost btn-sm">All transactions <ArrowRight size={11} /></Link>
      </div>
      <table className="w-full">
        <tbody>
          {transactions.map((t, i) => {
            const date = new Date(t.postingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const entity = (t.confirmedEntity || t.entityTag) as EntityType;
            return (
              <tr key={t.id} className={i < transactions.length - 1 ? 'border-b border-line' : ''}>
                <td className="px-5 py-2.5 w-[58px]">
                  <span className="num text-[11px] text-ink-mute">{date}</span>
                </td>
                <td className="px-3 py-2.5 w-[28px]">
                  <EntityMark entity={entity} size={20} />
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-[12.5px] font-medium tracking-tight truncate max-w-[280px]">
                    {t.merchantName || t.description.slice(0, 48)}
                  </div>
                  <div className="text-[10.5px] text-ink-ghost mt-0.5 mono">···{t.accountId}</div>
                </td>
                <td className="px-3 py-2.5">
                  <CategoryChip category={t.subCategory1} entity={entity} />
                </td>
                <td className="px-5 py-2.5 text-right w-[120px]">
                  <span className={`num text-[13px] font-semibold ${t.amount >= 0 ? 'text-income' : 'text-expense'}`}>
                    {t.amount >= 0 ? '+' : '−'}${Math.abs(t.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
