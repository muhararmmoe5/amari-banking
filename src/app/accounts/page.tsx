import Link from 'next/link';
import { ACCOUNTS, ENTITY_COLORS } from '@/constants/accounts';
import { summarizeAccounts } from '@/lib/db/queries';
import { Money } from '@/components/Money';
import { EntityBadge } from '@/components/EntityBadge';
import { fmtMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function AccountsPage() {
  const summaries = summarizeAccounts();
  const map = new Map(summaries.map((s) => [s.accountId, s]));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <p className="text-sm text-ink-dim mt-1">All 15 Chase accounts and their entity assignment.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ACCOUNTS.map((a) => {
          const s = map.get(a.id);
          return (
            <Link key={a.id} href={`/transactions?account=${a.id}`} className="card p-4 hover:border-entity-bytes/40 transition">
              <div className="h-1 -m-4 mb-3 rounded-t-xl" style={{ background: ENTITY_COLORS[a.entity] }} />
              <div className="flex items-start justify-between">
                <div>
                  <div className="mono text-xs text-ink-mute">···{a.last4}</div>
                  <div className="font-medium mt-0.5">{a.label}</div>
                  <div className="text-xs text-ink-mute mt-1 max-w-[280px]">{a.purpose}</div>
                </div>
                <EntityBadge entity={a.entity} size="xs" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-ink-mute">Income</div>
                  <div className="mono tabnum text-income">{fmtMoney(s?.income || 0)}</div>
                </div>
                <div>
                  <div className="text-ink-mute">Expenses</div>
                  <div className="mono tabnum text-expense">{fmtMoney(s?.expenses || 0)}</div>
                </div>
                <div>
                  <div className="text-ink-mute">Net</div>
                  <div className="mono tabnum"><Money value={s?.net || 0} /></div>
                </div>
              </div>
              <div className="mt-3 text-[11px] text-ink-mute">
                {s?.count || 0} external · {s?.internalCount || 0} internal
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
