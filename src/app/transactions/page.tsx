import Link from 'next/link';
import { listTransactions, countTransactions } from '@/lib/db/queries';
import { ACCOUNTS } from '@/constants/accounts';
import VirtualTable from './VirtualTable';
import type { EntityType, AuditStatus } from '@/types';

export const dynamic = 'force-dynamic';

interface SearchProps {
  account?: string;
  entity?: string;
  status?: string;
  search?: string;
  internal?: string;
  flagged?: string;
}

export default function TransactionsPage({ searchParams }: { searchParams: SearchProps }) {
  const hideInternal = searchParams.internal !== '1';
  const filters = {
    accountId: searchParams.account,
    entityTag: searchParams.entity as EntityType | undefined,
    auditStatus: searchParams.status as AuditStatus | undefined,
    search: searchParams.search,
    hideInternal,
    flaggedOnly: searchParams.flagged === '1',
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
        </div>
        <Link href="/import" className="btn btn-primary">⬆ Import more</Link>
      </div>

      <form className="card p-4 grid grid-cols-1 md:grid-cols-6 gap-3 text-xs" method="GET">
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
        <div className="flex items-center gap-3 text-ink-dim">
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" name="internal" value="1" defaultChecked={!hideInternal} className="accent-entity-bytes" />
            Show internal
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" name="flagged" value="1" defaultChecked={filters.flaggedOnly} className="accent-entity-bytes" />
            Flags only
          </label>
        </div>
        <div className="md:col-span-6 flex justify-end gap-2">
          <Link href="/transactions" className="btn">Clear</Link>
          <button type="submit" className="btn btn-primary">Apply filters</button>
        </div>
      </form>

      <VirtualTable rows={rows} />
    </div>
  );
}
