import Link from 'next/link';
import { allEntitySummaries, listHoldings, listPeople } from '@/lib/db/cap';
import { ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import { fmtCents, fmtPct } from '@/lib/cap';
import { ArrowRight } from 'lucide-react';
import type { EntityType } from '@/types';

export const dynamic = 'force-dynamic';

export default function CapOverviewPage() {
  const summaries = allEntitySummaries();
  const people = listPeople();
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const allHoldings = listHoldings();
  const holdingsByEntity = new Map<EntityType, typeof allHoldings>();
  for (const h of allHoldings) {
    const list = holdingsByEntity.get(h.entity) || [];
    list.push(h);
    holdingsByEntity.set(h.entity, list);
  }

  return (
    <div className="p-8 space-y-6 max-w-[1320px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cap table</h1>
          <p className="text-sm text-ink-dim mt-1">
            Equity, cash contributions, and outstanding SAFEs across your 5 business entities.
          </p>
        </div>
        <Link href="/team" className="btn">Manage people →</Link>
      </div>

      {people.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <h2 className="text-lg font-medium">Add people first</h2>
          <p className="text-sm text-ink-dim">Founders, partners, and investors live on the Team page. Once you've added a few, come back here to assign equity and log contributions.</p>
          <Link href="/team" className="btn btn-primary inline-flex">Go to Team</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {summaries.map((s) => {
            const holders = (holdingsByEntity.get(s.entity) || []).slice(0, 4);
            const unallocated = Math.max(0, 100 - s.totalEquityPct);
            return (
              <Link
                key={s.entity}
                href={`/cap/${s.entity}`}
                className="card p-5 space-y-4 hover:border-entity-bytes/40 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: ENTITY_COLORS[s.entity] }} />
                      <h3 className="font-medium">{ENTITY_LABELS[s.entity]}</h3>
                    </div>
                    <div className="text-[11px] text-ink-mute">
                      {s.holderCount} holder{s.holderCount === 1 ? '' : 's'} ·
                      {' '}{s.contributorCount} contributor{s.contributorCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-ink-mute" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Stat label="Allocated equity" value={fmtPct(s.totalEquityPct, 1)} tone={Math.abs(s.totalEquityPct - 100) < 0.01 ? 'good' : 'neutral'} />
                  <Stat label="Total cash in" value={fmtCents(s.totalCashCents)} tone="income" />
                  <Stat label="SAFEs outstanding" value={s.outstandingSafeCount.toString()} sub={s.outstandingSafeCents > 0 ? fmtCents(s.outstandingSafeCents) : undefined} />
                  <Stat label="Unallocated %" value={fmtPct(unallocated, 1)} tone={unallocated < 0.01 ? 'good' : unallocated > 50 ? 'warn' : 'neutral'} />
                </div>

                {holders.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-ink-mute">Top holders</div>
                    {holders.map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-ink-dim">{peopleById.get(h.personId)?.name || '?'}</span>
                        <span className="mono tabnum">{fmtPct(h.percent, 2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-ink-mute italic">No equity allocated yet.</div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'neutral', sub }: { label: string; value: string; tone?: 'neutral' | 'good' | 'warn' | 'income'; sub?: string }) {
  const colors = {
    neutral: 'text-ink',
    good: 'text-income',
    warn: 'text-warn',
    income: 'text-income',
  } as const;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-mute">{label}</div>
      <div className={`mono tabnum font-medium ${colors[tone]}`}>{value}</div>
      {sub ? <div className="text-[10px] text-ink-mute mono">{sub}</div> : null}
    </div>
  );
}
