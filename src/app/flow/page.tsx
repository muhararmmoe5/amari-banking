import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getCurrentBalances,
  listLargeInflows,
  type InflowEvent,
} from '@/lib/db/queries';
import { ACCOUNTS, ENTITY_COLORS, ENTITY_LABELS } from '@/constants/accounts';
import { fmtMoney } from '@/lib/format';
import FlowList from './FlowList';

export const dynamic = 'force-dynamic';

interface SP { min?: string; account?: string; source?: string; from?: string; to?: string }

export default function FlowPage({ searchParams }: { searchParams: SP }) {
  const user = requireUser();
  if (user.role !== 'OWNER') redirect('/cap');

  const minAmount = parseInt(searchParams.min || '1000', 10);
  const inflows: InflowEvent[] = listLargeInflows({
    minAmount: Math.max(0, Math.min(1_000_000, isNaN(minAmount) ? 1000 : minAmount)),
    limit: 50,
    accountId: searchParams.account,
    incomeSource: searchParams.source,
    dateFrom: searchParams.from,
    dateTo: searchParams.to,
  });

  const balances = getCurrentBalances();
  const totalCash = Array.from(balances.values()).reduce((s, b) => s + b.balance, 0);

  return (
    <div className="p-8 space-y-6 max-w-[1320px]">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Cash Flow</h1>
        <p className="text-sm text-ink-dim mt-1">
          Where your money is right now, and where it went after each inflow.
        </p>
      </div>

      {/* Balances row */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">Current balances</h2>
          <div className="mono tabnum text-sm">
            Total across all accounts: <span className={totalCash >= 0 ? 'text-income' : 'text-expense'}>{fmtMoney(totalCash)}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {ACCOUNTS.map((a) => {
            const b = balances.get(a.id);
            const balance = b?.balance ?? null;
            return (
              <Link
                key={a.id}
                href={`/transactions?account=${a.id}`}
                className="card p-3 hover:border-entity-bytes/40 transition"
              >
                <div className="h-1 -m-3 mb-2 rounded-t-xl" style={{ background: ENTITY_COLORS[a.entity] }} />
                <div className="text-[10px] text-ink-mute mono">···{a.last4}</div>
                <div className="text-xs font-medium truncate">{a.label}</div>
                <div className={`mono tabnum text-lg mt-1 ${balance == null ? 'text-ink-mute' : balance >= 0 ? 'text-ink' : 'text-expense'}`}>
                  {balance != null ? fmtMoney(balance) : '—'}
                </div>
                <div className="text-[10px] text-ink-mute">
                  {b ? `as of ${b.asOfDate}` : 'no imported balance'}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Inflow filter */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Trace an inflow</h2>
          <div className="text-[11px] text-ink-mute">Click any inflow to see same-day outflows on that account.</div>
        </div>
        <form className="card p-3 flex flex-wrap gap-3 text-xs" method="GET">
          <label className="flex items-center gap-2">
            <span className="text-ink-mute">Min amount $</span>
            <input name="min" type="number" min="0" step="100" defaultValue={searchParams.min || '1000'} className="w-24" />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-ink-mute">Account</span>
            <select name="account" defaultValue={searchParams.account || ''}>
              <option value="">Any</option>
              {ACCOUNTS.map((a) => <option key={a.id} value={a.id}>···{a.last4} — {a.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-ink-mute">Source</span>
            <select name="source" defaultValue={searchParams.source || ''}>
              <option value="">Any</option>
              <option value="SPACETEL">Spacetel</option>
              <option value="OMAR_ALGHAZALI">Omar Alghazali</option>
              <option value="TCETRA">TCETRA</option>
              <option value="VIDAPAY">Vidapay</option>
              <option value="STRIPE">Stripe</option>
              <option value="DOORDASH">DoorDash</option>
              <option value="GRUBHUB">Grubhub</option>
              <option value="UBER_EATS">Uber Eats</option>
              <option value="GUSTO">Gusto</option>
              <option value="ZELLE_IN">Zelle inbound</option>
              <option value="WIRE_UNKNOWN">Unknown wires</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-ink-mute">From</span>
            <input name="from" type="date" defaultValue={searchParams.from || ''} />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-ink-mute">To</span>
            <input name="to" type="date" defaultValue={searchParams.to || ''} />
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <Link href="/flow" className="btn">Clear</Link>
            <button type="submit" className="btn btn-primary">Apply</button>
          </div>
        </form>

        <FlowList inflows={inflows} />
      </section>
    </div>
  );
}
