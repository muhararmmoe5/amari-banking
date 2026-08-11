import { getDb } from '@/lib/db';
import { Money } from '@/components/Money';
import { fmtDate } from '@/lib/format';
import { requireUser, hasEditAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ReconcilePage() {
  const user = requireUser();
  if (!hasEditAccess(user)) redirect('/cap');
  const db = getDb();
  const matchCount = (db.prepare('SELECT COUNT(*) c FROM reconciliation_matches').get() as { c: number }).c;
  const unmatched = db.prepare(`
    SELECT id, account_id, posting_date, description, amount
    FROM transactions
    WHERE is_internal = 1 AND internal_linked_id IS NULL
    ORDER BY posting_date DESC
    LIMIT 200
  `).all() as any[];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Reconciliation</h1>
        <p className="text-sm text-ink-dim mt-1">
          Internal transfer matching — pairs outflows in one account to inflows in another within 2 days, same amount.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Matched pairs" value={String(matchCount)} />
        <Kpi label="Unmatched internal" value={String(unmatched.length)} />
        <Kpi label="" value=" " />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line text-sm font-medium">Unmatched internal transfers</div>
        <table className="w-full text-sm">
          <thead className="bg-bg-2 text-ink-dim">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Account</th>
              <th className="text-left px-3 py-2 font-medium">Description</th>
              <th className="text-right px-3 py-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {unmatched.length === 0 ? (
              <tr><td colSpan={4} className="text-center px-3 py-12 text-ink-mute">All internal transfers are reconciled 🎉</td></tr>
            ) : (
              unmatched.map((r) => (
                <tr key={r.id} className="border-t border-line/60">
                  <td className="px-3 py-2 text-xs text-ink-dim mono">{fmtDate(r.posting_date)}</td>
                  <td className="px-3 py-2 text-xs mono">···{r.account_id}</td>
                  <td className="px-3 py-2 text-sm truncate max-w-[480px]">{r.description}</td>
                  <td className="px-3 py-2 text-right"><Money value={r.amount} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wider text-ink-mute">{label || ''}</div>
      <div className="mt-2 text-xl font-semibold mono tabnum">{value}</div>
    </div>
  );
}
