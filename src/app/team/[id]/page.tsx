import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getPerson, personRollup, valuePersonHoldings } from '@/lib/db/cap';
import { ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import { fmtCents, fmtPct } from '@/lib/cap';
import { requireUser, hasEditAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const ROLES: Record<string, { label: string; color: string }> = {
  FOUNDER: { label: 'Founder', color: '#C8F060' },
  INVESTOR: { label: 'Investor', color: '#60C8F0' },
  EMPLOYEE: { label: 'Employee', color: '#A0D8FF' },
  CONTRACTOR: { label: 'Contractor', color: '#F0A060' },
  ADVISOR: { label: 'Advisor', color: '#C060F0' },
  OTHER: { label: 'Other', color: '#888888' },
};

const HOLDER_TYPES: Record<string, { label: string; color: string }> = {
  PARTNER: { label: 'Partner', color: '#C8F060' },
  TEAM_MEMBER: { label: 'Team member', color: '#60C8F0' },
  OBSERVER: { label: 'Observer', color: '#888888' },
};

export default function PersonDetailPage({ params }: { params: { id: string } }) {
  const user = requireUser();
  // Non-owners may only see their own person page
  if (!hasEditAccess(user) && user.personId !== params.id) {
    if (user.personId) redirect(`/team/${user.personId}`);
    redirect('/cap');
  }
  const person = getPerson(params.id);
  if (!person) notFound();

  const rollup = personRollup(params.id)!;
  const valuation = valuePersonHoldings(params.id);
  const role = ROLES[person.role] || ROLES.OTHER;

  return (
    <div className="p-8 space-y-6 max-w-[1200px]">
      <div>
        <Link href="/team" className="inline-flex items-center gap-1 text-xs text-ink-mute hover:text-ink mb-3">
          <ArrowLeft size={12} /> Back to team
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">{person.name}</h1>
          <span
            className="pill text-xs"
            style={{ background: `${role.color}1f`, color: role.color, border: `1px solid ${role.color}40` }}
          >
            {role.label}
          </span>
        </div>
        <p className="text-sm text-ink-dim mt-1">
          {person.email || 'no email'}{person.notes ? ` · ${person.notes}` : ''}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi label="Vested portfolio (today)" value={valuation.totalVestedCents > 0 ? fmtCents(valuation.totalVestedCents) : 'No valuations set'} tone="primary" />
        <Kpi label="Granted portfolio" value={valuation.totalGrantedCents > 0 ? fmtCents(valuation.totalGrantedCents) : '—'} tone="neutral" />
        <Kpi label="Cash contributed" value={fmtCents(rollup.totalCashCents)} tone="income" />
        <Kpi label="SAFEs outstanding" value={rollup.safes.filter((s) => s.status === 'OUTSTANDING').length.toString()} sub={fmtCents(rollup.safes.filter((s) => s.status === 'OUTSTANDING').reduce((sum, s) => sum + s.amountCents, 0))} />
      </div>

      {/* Holdings */}
      <section>
        <h2 className="text-sm font-medium mb-3">Equity holdings</h2>
        {rollup.holdings.length === 0 ? (
          <div className="card p-8 text-center text-ink-mute text-sm">No equity holdings yet.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-2 text-ink-dim text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Entity</th>
                  <th className="text-left px-3 py-2 font-medium">Role</th>
                  <th className="text-right px-3 py-2 font-medium">% granted</th>
                  <th className="text-right px-3 py-2 font-medium">% vested</th>
                  <th className="text-right px-3 py-2 font-medium">Valuation</th>
                  <th className="text-right px-3 py-2 font-medium">Vested value</th>
                </tr>
              </thead>
              <tbody>
                {valuation.rows.map((r) => {
                  const h = r.holding;
                  const hc = HOLDER_TYPES[h.holderType] || HOLDER_TYPES.PARTNER;
                  return (
                    <tr key={h.id} className="border-t border-line/60">
                      <td className="px-3 py-2">
                        <Link href={`/cap/${h.entity}`} className="inline-flex items-center gap-2 hover:text-entity-bytes">
                          <span className="w-2 h-2 rounded-full" style={{ background: ENTITY_COLORS[h.entity] }} />
                          {ENTITY_LABELS[h.entity]}
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <span className="pill text-[10px]" style={{ background: `${hc.color}1f`, color: hc.color, border: `1px solid ${hc.color}40` }}>
                          {hc.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right mono tabnum">{fmtPct(h.percent, 2)}</td>
                      <td className="px-3 py-2 text-right mono tabnum">{fmtPct(h.percent * r.vestedFraction, 2)}</td>
                      <td className="px-3 py-2 text-right mono tabnum text-ink-dim">
                        {r.currentValuationCents != null ? fmtCents(r.currentValuationCents) : 'not set'}
                      </td>
                      <td className="px-3 py-2 text-right mono tabnum">
                        {r.vestedValueCents != null ? <span className="text-income">{fmtCents(r.vestedValueCents)}</span> : <span className="text-ink-mute">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Contributions */}
      <section>
        <h2 className="text-sm font-medium mb-3">Cash contributions</h2>
        {rollup.contributions.length === 0 ? (
          <div className="card p-8 text-center text-ink-mute text-sm">No contributions logged.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-2 text-ink-dim text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Date</th>
                  <th className="text-left px-3 py-2 font-medium">Entity</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rollup.contributions.map((c) => (
                  <tr key={c.id} className="border-t border-line/60">
                    <td className="px-3 py-2 text-xs text-ink-dim mono">{c.contributionDate}</td>
                    <td className="px-3 py-2">
                      <Link href={`/cap/${c.entity}`} className="inline-flex items-center gap-2 hover:text-entity-bytes">
                        <span className="w-2 h-2 rounded-full" style={{ background: ENTITY_COLORS[c.entity] }} />
                        {ENTITY_LABELS[c.entity]}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right mono tabnum text-income">{fmtCents(c.amountCents)}</td>
                    <td className="px-3 py-2 text-xs text-ink-dim">{c.type.replace('_', ' ').toLowerCase()}</td>
                    <td className="px-3 py-2 text-xs text-ink-dim truncate max-w-[300px]">{c.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SAFEs */}
      {rollup.safes.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium mb-3">SAFEs / convertible notes</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg-2 text-ink-dim text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Issued</th>
                  <th className="text-left px-3 py-2 font-medium">Entity</th>
                  <th className="text-right px-3 py-2 font-medium">Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-right px-3 py-2 font-medium">Cap</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rollup.safes.map((s) => (
                  <tr key={s.id} className="border-t border-line/60">
                    <td className="px-3 py-2 text-xs text-ink-dim mono">{s.issueDate}</td>
                    <td className="px-3 py-2">{ENTITY_LABELS[s.entity]}</td>
                    <td className="px-3 py-2 text-right mono tabnum">{fmtCents(s.amountCents)}</td>
                    <td className="px-3 py-2 text-xs text-ink-dim">{s.noteType === 'SAFE' ? 'SAFE' : 'Conv. note'}</td>
                    <td className="px-3 py-2 text-right mono tabnum text-ink-dim">{s.valuationCapCents ? fmtCents(s.valuationCapCents) : '—'}</td>
                    <td className="px-3 py-2 text-xs">{s.status.toLowerCase()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, tone = 'neutral', sub }: { label: string; value: string; tone?: 'primary' | 'income' | 'neutral'; sub?: string }) {
  const tones = { primary: 'text-entity-bytes', income: 'text-income', neutral: 'text-ink' } as const;
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</div>
      <div className={`mono tabnum text-xl font-semibold mt-1 ${tones[tone]}`}>{value}</div>
      {sub ? <div className="text-[10px] text-ink-mute mono mt-0.5">{sub}</div> : null}
    </div>
  );
}
