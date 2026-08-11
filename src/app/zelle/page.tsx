import { zelleByPerson } from '@/lib/db/queries';
import { fmtMoney, fmtDate } from '@/lib/format';
import { lookupZellePerson } from '@/constants/zelle-persons';
import { ENTITY_LABELS } from '@/constants/accounts';
import { requireUser, hasEditAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ZellePage() {
  const user = requireUser();
  if (!hasEditAccess(user)) redirect('/cap');
  const rows = zelleByPerson();
  const total = rows.reduce((s, r) => s + r.totalPaid, 0);
  const required1099 = rows.filter((r) => r.totalPaid >= 600 && (r.zelleType === 'CONTRACTOR' || r.zelleType === 'COMPENSATION')).length;
  const unclassified = rows.filter((r) => {
    const info = lookupZellePerson(r.person);
    return !info.knownPerson;
  }).length;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Zelle / 1099 compliance</h1>
        <p className="text-sm text-ink-dim mt-1">Every Zelle outflow grouped by recipient. Identify contractors who require a 1099.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total Zelle out" value={fmtMoney(total)} tone="expense" />
        <Kpi label="People paid" value={String(rows.length)} tone="neutral" />
        <Kpi label="1099 required" value={String(required1099)} tone="warn" />
        <Kpi label="Unclassified" value={String(unclassified)} tone="crit" />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-bg-2 text-ink-dim">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Recipient</th>
              <th className="text-right px-3 py-2 font-medium">Total paid</th>
              <th className="text-right px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium">Last paid</th>
              <th className="text-left px-3 py-2 font-medium">Auto entity</th>
              <th className="text-left px-3 py-2 font-medium">Type</th>
              <th className="text-left px-3 py-2 font-medium">1099?</th>
              <th className="text-left px-3 py-2 font-medium">Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-12 text-center text-ink-mute">No Zelle activity recorded yet.</td></tr>
            ) : (
              rows.map((r) => {
                const info = lookupZellePerson(r.person);
                const rowClass = !info.knownPerson
                  ? 'bg-flag-critBg/30'
                  : info.needs1099 || r.totalPaid >= 600
                    ? 'bg-flag-medBg/30'
                    : '';
                return (
                  <tr key={r.person} className={`border-t border-line/60 ${rowClass}`}>
                    <td className="px-3 py-2 font-medium">{r.person}</td>
                    <td className="px-3 py-2 text-right mono tabnum text-expense">{fmtMoney(r.totalPaid)}</td>
                    <td className="px-3 py-2 text-right">{r.count}</td>
                    <td className="px-3 py-2 text-xs text-ink-dim">{fmtDate(r.lastDate)}</td>
                    <td className="px-3 py-2 text-xs">{ENTITY_LABELS[info.entity]}</td>
                    <td className="px-3 py-2 text-xs">{r.zelleType || info.type}</td>
                    <td className="px-3 py-2 text-xs">
                      {info.needs1099 || r.totalPaid >= 600 ? <span className="text-warn font-medium">{info.needs1099 ? 'YES' : 'Verify'}</span> : <span className="text-ink-mute">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-warn">{info.flagNote || ''}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'income' | 'expense' | 'neutral' | 'warn' | 'crit' }) {
  const tones = { income: 'text-income', expense: 'text-expense', neutral: 'text-ink', warn: 'text-warn', crit: 'text-flag-critText' };
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</div>
      <div className={`mt-2 text-xl font-semibold mono tabnum ${tones[tone]}`}>{value}</div>
    </div>
  );
}
