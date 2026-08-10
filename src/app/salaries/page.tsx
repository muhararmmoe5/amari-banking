import { requireUser, hasEditAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { listSalaries, spendBySalary } from '@/lib/db/salaries';
import { listPeople } from '@/lib/db/cap';
import { listBudgetsWithSpend } from '@/lib/db/budgets';
import { ENTITY_LABELS, ENTITY_COLORS, BUSINESS_ENTITIES } from '@/constants/accounts';
import type { EntityType } from '@/types';
import { PageTitle } from '@/components/PageTitle';
import SalaryEditor from './SalaryEditor';

export const dynamic = 'force-dynamic';

export default function SalariesPage() {
  const user = requireUser();
  if (!hasEditAccess(user)) redirect('/cap');

  const salaries = listSalaries();
  const people = listPeople();
  const spend = spendBySalary();
  const budgets = listBudgetsWithSpend();

  // Group both salaries and budgets by entity
  const byEntity = new Map<string, { salaries: typeof salaries; budgets: typeof budgets }>();
  for (const e of BUSINESS_ENTITIES) byEntity.set(e, { salaries: [], budgets: [] });
  for (const s of salaries) {
    const k = s.entity;
    if (!byEntity.has(k)) byEntity.set(k, { salaries: [], budgets: [] });
    byEntity.get(k)!.salaries.push(s);
  }
  for (const b of budgets) {
    const k = b.entity || 'BUSINESS_SHARED';
    if (!byEntity.has(k)) byEntity.set(k, { salaries: [], budgets: [] });
    byEntity.get(k)!.budgets.push(b);
  }

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <PageTitle accent="Sal">aries &amp; budgets</PageTitle>
        <p className="text-sm text-ink-dim mt-1.5">
          Master records for who gets paid what at each entity. Tag transactions
          (or split parts) against these so you can see total paid vs owed.
        </p>
      </div>

      <SalaryEditor people={people} />

      {Array.from(byEntity.entries()).map(([entity, group]) => {
        const color = (ENTITY_COLORS as any)[entity] || '#6f6e68';
        const label = (ENTITY_LABELS as any)[entity] || entity;
        const monthlyPayroll = group.salaries.reduce((s, x) => s + (x.status === 'ACTIVE' ? x.monthlyAmountCents : 0), 0);
        const monthlyBudget = group.budgets.reduce((s, x) => s + (x.monthlyAmountCents || 0), 0);
        if (group.salaries.length === 0 && group.budgets.length === 0) return null;
        return (
          <div key={entity} className="card overflow-hidden">
            <div className="card-head" style={{ cursor: 'default' }}>
              <div className="flex items-center gap-2.5">
                <span style={{ width: 10, height: 10, borderRadius: 50, background: color }} />
                <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>{label}</span>
              </div>
              <span className="flex-1" />
              <div className="flex items-center gap-4 text-[11px] text-ink-mute">
                <span>
                  Monthly payroll <span className="num text-ink">${(monthlyPayroll / 100).toLocaleString()}</span>
                </span>
                <span>
                  Monthly budget <span className="num text-ink">${(monthlyBudget / 100).toLocaleString()}</span>
                </span>
              </div>
            </div>
            <div className="card-body" style={{ paddingTop: 6 }}>
              {group.salaries.length > 0 ? (
                <div>
                  <div className="field-label" style={{ marginBottom: 8 }}>Salaries · {group.salaries.length}</div>
                  <div className="flex flex-col gap-1.5">
                    {group.salaries.map((s) => {
                      const sp = spend.get(s.id);
                      const tagged = (sp?.taggedCents || 0) / 100;
                      const monthly = s.monthlyAmountCents / 100;
                      const pct = monthly > 0 ? Math.min(1, tagged / monthly) : 0;
                      const isPaused = s.status !== 'ACTIVE';
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-3"
                          style={{
                            padding: '8px 10px',
                            background: 'var(--bg-2)',
                            border: '0.5px solid var(--border-subtle, rgba(255,255,255,0.07))',
                            borderRadius: 7,
                            opacity: isPaused ? 0.55 : 1,
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                              {s.personName || '—'}
                              <span className="text-[10.5px] text-ink-mute ml-2">· {s.kind.toLowerCase()}</span>
                              {isPaused ? (
                                <span
                                  className="pill ml-2"
                                  style={{ fontSize: 9.5, color: 'var(--ink-3)', borderColor: 'var(--border-default)' }}
                                >
                                  {s.status.toLowerCase()}
                                </span>
                              ) : null}
                            </div>
                            {s.label ? <div className="text-[10.5px] text-ink-mute mt-px">{s.label}</div> : null}
                          </div>
                          <div className="text-right">
                            <div className="num text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                              ${monthly.toLocaleString(undefined, { minimumFractionDigits: 0 })}<span className="text-[10.5px] text-ink-mute">/mo</span>
                            </div>
                            <div className="text-[10.5px] text-ink-mute mt-px">
                              <span className="num">${tagged.toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                              {' '}tagged across {sp?.taggedCount || 0} parts
                            </div>
                          </div>
                          <div style={{ width: 110 }}>
                            <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{
                                width: `${pct * 100}%`,
                                height: '100%',
                                background: pct >= 1 ? 'var(--income)' : 'var(--gold)',
                                transition: 'width 220ms ease',
                              }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {group.budgets.length > 0 ? (
                <div className="mt-3">
                  <div className="field-label" style={{ marginBottom: 8 }}>Budgets · {group.budgets.length}</div>
                  <div className="flex flex-col gap-1.5">
                    {group.budgets.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center gap-3"
                        style={{
                          padding: '8px 10px',
                          background: 'var(--bg-2)',
                          border: '0.5px solid var(--border-subtle, rgba(255,255,255,0.07))',
                          borderRadius: 7,
                        }}
                      >
                        <div className="flex-1">
                          <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{b.name}</div>
                          {b.notes ? <div className="text-[10.5px] text-ink-mute mt-px">{b.notes}</div> : null}
                        </div>
                        <div className="text-right">
                          <div className="num text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                            ${((b.monthlyAmountCents || 0) / 100).toLocaleString()}<span className="text-[10.5px] text-ink-mute">/mo</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {group.salaries.length === 0 && group.budgets.length === 0 ? (
                <div className="text-[11.5px] text-ink-mute">No salaries or budgets yet for {label}.</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
