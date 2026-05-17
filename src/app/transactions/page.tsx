import Link from 'next/link';
import { listTransactions, countTransactions } from '@/lib/db/queries';
import { ACCOUNTS } from '@/constants/accounts';
import VirtualTable from './VirtualTable';
import RescanDatesButton from './RescanDatesButton';
import type { EntityType, AuditStatus } from '@/types';

export const dynamic = 'force-dynamic';

interface SearchProps {
  account?: string;
  entity?: string;
  status?: string;
  search?: string;
  internal?: string;
  flagged?: string;
  from?: string;
  to?: string;
  bookFrom?: string;
  bookTo?: string;
  preset?: string;
  order?: string;
}

function presetToRange(preset?: string): { from?: string; to?: string } {
  if (!preset) return {};
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case '7d': {
      const d = new Date(); d.setDate(d.getDate() - 6);
      return { from: fmt(d), to: fmt(now) };
    }
    case '30d': {
      const d = new Date(); d.setDate(d.getDate() - 29);
      return { from: fmt(d), to: fmt(now) };
    }
    case 'mtd': {
      return { from: fmt(new Date(y, m, 1)), to: fmt(now) };
    }
    case 'last_month': {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return { from: fmt(start), to: fmt(end) };
    }
    case 'qtd': {
      const q = Math.floor(m / 3);
      return { from: fmt(new Date(y, q * 3, 1)), to: fmt(now) };
    }
    case 'ytd': {
      return { from: fmt(new Date(y, 0, 1)), to: fmt(now) };
    }
    case 'last_year': {
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    }
    default: return {};
  }
}

export default function TransactionsPage({ searchParams }: { searchParams: SearchProps }) {
  const hideInternal = searchParams.internal !== '1';
  const presetRange = presetToRange(searchParams.preset);
  const dateFrom = searchParams.from || presetRange.from;
  const dateTo = searchParams.to || presetRange.to;
  const orderDir: 'ASC' | 'DESC' = searchParams.order === 'oldest' ? 'ASC' : 'DESC';
  const filters = {
    accountId: searchParams.account,
    entityTag: searchParams.entity as EntityType | undefined,
    auditStatus: searchParams.status as AuditStatus | undefined,
    search: searchParams.search,
    hideInternal,
    flaggedOnly: searchParams.flagged === '1',
    dateFrom,
    dateTo,
    bookDateFrom: searchParams.bookFrom,
    bookDateTo: searchParams.bookTo,
    orderDir,
    limit: 5000,
  };
  const rows = listTransactions(filters);
  const total = countTransactions({ hideInternal });

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-ink-dim mt-1">
            Showing {rows.length} of {total.toLocaleString()} non-internal transactions
          </p>
          {!searchParams.account ? (
            <p className="text-[11px] text-warn mt-1">
              💡 Tip: pick a single account in the filter below to read the running "Balance after" column like a bank statement.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/audit/deep${searchParams.account ? `?account=${searchParams.account}` : ''}`} className="btn">🔍 Deep source audit</Link>
          <RescanDatesButton />
          <Link href="/import" className="btn btn-primary">⬆ Import more</Link>
        </div>
      </div>

      <form className="card p-4 space-y-3 text-xs" method="GET">
        <div className="flex flex-wrap gap-1.5">
          {[
            { v: '', l: 'All time' },
            { v: '7d', l: 'Last 7d' },
            { v: '30d', l: 'Last 30d' },
            { v: 'mtd', l: 'Month-to-date' },
            { v: 'last_month', l: 'Last month' },
            { v: 'qtd', l: 'Quarter-to-date' },
            { v: 'ytd', l: 'Year-to-date' },
            { v: 'last_year', l: 'Last year' },
          ].map((p) => (
            <button
              key={p.v || 'all'}
              type="submit"
              name="preset"
              value={p.v}
              className={`pill border ${
                (searchParams.preset || '') === p.v
                  ? 'bg-entity-bytes text-bg-0 border-entity-bytes'
                  : 'bg-bg-2 text-ink-dim border-line hover:text-ink'
              }`}
            >
              {p.l}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input name="search" placeholder="Search description, merchant, Zelle name…" defaultValue={searchParams.search} className="md:col-span-2" />
          <select name="account" defaultValue={searchParams.account || ''}>
            <option value="">All accounts</option>
            {ACCOUNTS.map((a) => (
              <option key={a.id} value={a.id}>···{a.last4} — {a.label}</option>
            ))}
          </select>
          <select name="entity" defaultValue={searchParams.entity || ''}>
            <option value="">All entities</option>
            <option value="BYTES_AI">Bytes AI</option>
            <option value="ROCKET_WIRELESS">Rocket Wireless</option>
            <option value="DELICIOUS_BYTES">Delicious Bytes</option>
            <option value="AMARI_VENTURES">Amari Ventures</option>
            <option value="BYTES_REST_TECH">Bytes Rest Tech</option>
            <option value="PERSONAL">Personal</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
          <select name="status" defaultValue={searchParams.status || ''}>
            <option value="">All statuses</option>
            <option value="UNREVIEWED">Unreviewed</option>
            <option value="TAGGED">Tagged</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="NEEDS_RECEIPT">Needs receipt</option>
            <option value="PERSONAL_NO_DEDUCT">Personal no-deduct</option>
          </select>
          <div className="flex items-center gap-3 text-ink-dim flex-wrap">
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" name="internal" value="1" defaultChecked={!hideInternal} className="accent-entity-bytes" />
              Show internal
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" name="flagged" value="1" defaultChecked={filters.flaggedOnly} className="accent-entity-bytes" />
              Flags only
            </label>
            <label className="inline-flex items-center gap-1">
              <span className="text-ink-mute">Order</span>
              <select name="order" defaultValue={searchParams.order === 'oldest' ? 'oldest' : 'newest'}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Posted on bank · From</div>
            <input name="from" type="date" defaultValue={searchParams.from || ''} className="w-full" />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Posted on bank · To</div>
            <input name="to" type="date" defaultValue={searchParams.to || ''} className="w-full" />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Booking date · From</div>
            <input name="bookFrom" type="date" defaultValue={searchParams.bookFrom || ''} className="w-full" />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Booking date · To</div>
            <input name="bookTo" type="date" defaultValue={searchParams.bookTo || ''} className="w-full" />
          </label>
          <div className="md:col-span-4 flex justify-end gap-2">
            <Link href="/transactions" className="btn">Clear</Link>
            <button type="submit" className="btn btn-primary">Apply filters</button>
          </div>
        </div>
      </form>

      <VirtualTable rows={rows} />
    </div>
  );
}
