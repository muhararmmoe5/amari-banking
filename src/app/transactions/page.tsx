import Link from 'next/link';
import { listTransactions, countTransactions, reviewBucketCounts } from '@/lib/db/queries';
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
  review?: string;
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
  const reviewBucket: 'PENDING_REVIEW' | 'REVIEWED' | 'REVIEWED_APPROVED' | 'ESCALATIONS' | 'ALL' =
    searchParams.review === 'reviewed' ? 'REVIEWED'
      : searchParams.review === 'approved' ? 'REVIEWED_APPROVED'
      : searchParams.review === 'escalations' ? 'ESCALATIONS'
      : searchParams.review === 'all' ? 'ALL'
      : 'PENDING_REVIEW'; // default — every transaction starts as pending review
  const filters = {
    accountId: searchParams.account,
    entityTag: searchParams.entity as EntityType | undefined,
    auditStatus: searchParams.status as AuditStatus | undefined,
    search: searchParams.search,
    hideInternal,
    flaggedOnly: searchParams.flagged === '1',
    reviewBucket,
    dateFrom,
    dateTo,
    bookDateFrom: searchParams.bookFrom,
    bookDateTo: searchParams.bookTo,
    orderDir,
    limit: 5000,
  };
  const rawRows = listTransactions(filters);

  // True running balance for the selected account.
  //
  // When a single account is filtered, we pull the COMPLETE chronological
  // list for that account (irrespective of other filters / hidden rows),
  // anchor at the oldest row's reported Chase balance, and walk forward
  // computing balance[i] = balance[i-1] + amount[i]. Each visible row then
  // gets looked up from that map.
  //
  // This gives every row a balance that reflects the real account state at
  // its moment, with no gaps from hidden rows. If Chase's own per-row
  // balances were already correct (they usually are), this is identical to
  // what was imported. If a same-day ordering disagreement causes drift,
  // this re-computes it cleanly.
  let rows = rawRows;
  if (filters.accountId) {
    const full = listTransactions({
      accountId: filters.accountId,
      hideInternal: false,
      orderDir: 'ASC',
      limit: 50000,
    });
    if (full.length > 0) {
      const balanceById = new Map<string, number>();
      // Anchor: the oldest row's reported Chase balance was AFTER it posted.
      // So the pre-anchor balance = anchor.balance - anchor.amount.
      const anchor = full[0];
      if (anchor.balance != null) {
        balanceById.set(anchor.id, anchor.balance);
        let running = anchor.balance;
        for (let i = 1; i < full.length; i++) {
          running = running + full[i].amount;
          balanceById.set(full[i].id, running);
        }
      }
      rows = rawRows.map((r) => {
        const computed = balanceById.get(r.id);
        return computed != null ? { ...r, balance: computed } : r;
      });
    }
  }
  const total = countTransactions({ hideInternal });
  const buckets = reviewBucketCounts();

  // Build href that preserves all current search params except `review`.
  function reviewHref(bucket: string): string {
    const q: Record<string, string> = {};
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === 'review') continue;
      if (typeof v === 'string' && v) q[k] = v;
    }
    if (bucket && bucket !== 'pending') q.review = bucket;
    const qs = new URLSearchParams(q).toString();
    return `/transactions${qs ? `?${qs}` : ''}`;
  }

  const tabs: Array<{ key: string; label: string; count: number; color: string }> = [
    { key: 'pending', label: 'Pending review', count: buckets.pending, color: 'var(--warn)' },
    { key: 'reviewed', label: 'Reviewed', count: buckets.reviewed, color: 'var(--blue, #60a5fa)' },
    { key: 'approved', label: 'Reviewed & approved', count: buckets.approved, color: 'var(--income)' },
    { key: 'escalations', label: 'Escalations', count: buckets.escalations, color: 'var(--expense)' },
    { key: 'all', label: 'All', count: buckets.all, color: 'var(--ink-2)' },
  ];
  const activeTab = searchParams.review || 'pending';

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-ink-dim mt-1.5">
            Showing <span className="text-ink font-medium num-display">{rows.length}</span> of <span className="num-display">{total.toLocaleString()}</span> non-internal transactions
          </p>
          {!searchParams.account ? (
            <p className="text-2xs text-warn mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warn/5 border border-warn/20">
              💡 Pick a single account to read the running &ldquo;Balance after&rdquo; like a bank statement.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/audit/deep${searchParams.account ? `?account=${searchParams.account}` : ''}`} className="btn">🔍 Deep audit</Link>
          <RescanDatesButton />
          <Link href="/import" className="btn btn-primary">⬆ Import more</Link>
        </div>
      </div>

      {/* Review workflow tabs */}
      <div
        className="flex flex-wrap gap-1.5"
        style={{
          padding: 4,
          background: 'var(--bg-2)',
          border: '0.5px solid var(--border-subtle, rgba(255,255,255,0.07))',
          borderRadius: 10,
        }}
      >
        {tabs.map((t) => {
          const active = activeTab === t.key;
          return (
            <Link
              key={t.key}
              href={reviewHref(t.key)}
              className="inline-flex items-center gap-2"
              style={{
                padding: '7px 14px',
                borderRadius: 7,
                background: active ? `color-mix(in oklab, ${t.color} 12%, var(--bg-0))` : 'transparent',
                border: '0.5px solid ' + (active ? t.color : 'transparent'),
                color: active ? t.color : 'var(--ink-2)',
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                transition: 'all 120ms ease',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 50, background: t.color }} />
              {t.label}
              <span
                className="num"
                style={{
                  fontSize: 10.5,
                  padding: '1px 6px',
                  borderRadius: 50,
                  background: active ? `color-mix(in oklab, ${t.color} 18%, var(--bg-0))` : 'var(--bg-3)',
                  color: active ? t.color : 'var(--ink-3)',
                  minWidth: 22,
                  textAlign: 'center',
                }}
              >
                {t.count.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>

      <form className="card p-5 space-y-4 text-xs" method="GET">
        {/* Preserve the review tab when the user submits other filters */}
        {searchParams.review ? (
          <input type="hidden" name="review" value={searchParams.review} />
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {[
            { v: '', l: 'All time' },
            { v: '7d', l: 'Last 7d' },
            { v: '30d', l: 'Last 30d' },
            { v: 'mtd', l: 'MTD' },
            { v: 'last_month', l: 'Last month' },
            { v: 'qtd', l: 'QTD' },
            { v: 'ytd', l: 'YTD' },
            { v: 'last_year', l: 'Last year' },
          ].map((p) => (
            <button
              key={p.v || 'all'}
              type="submit"
              name="preset"
              value={p.v}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                (searchParams.preset || '') === p.v
                  ? 'bg-entity-bytes text-bg-0 border-entity-bytes shadow-glow-bytes'
                  : 'bg-bg-2/60 text-ink-dim border-line hover:text-ink hover:bg-bg-2 hover:border-line-strong'
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
          <div className="flex items-center gap-4 text-ink-dim flex-wrap">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" name="internal" value="1" defaultChecked={!hideInternal} className="accent-entity-bytes" />
              Show internal
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" name="flagged" value="1" defaultChecked={filters.flaggedOnly} className="accent-entity-bytes" />
              Flags only
            </label>
            <label className="inline-flex items-center gap-1.5">
              <span className="text-ink-mute">Order</span>
              <select name="order" defaultValue={searchParams.order === 'oldest' ? 'oldest' : 'newest'}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>
        </div>
        <div className="divider-soft" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="block">
            <div className="section-label mb-1.5">Posted on bank · From</div>
            <input name="from" type="date" defaultValue={searchParams.from || ''} className="w-full" />
          </label>
          <label className="block">
            <div className="section-label mb-1.5">Posted on bank · To</div>
            <input name="to" type="date" defaultValue={searchParams.to || ''} className="w-full" />
          </label>
          <label className="block">
            <div className="section-label mb-1.5">Booking date · From</div>
            <input name="bookFrom" type="date" defaultValue={searchParams.bookFrom || ''} className="w-full" />
          </label>
          <label className="block">
            <div className="section-label mb-1.5">Booking date · To</div>
            <input name="bookTo" type="date" defaultValue={searchParams.bookTo || ''} className="w-full" />
          </label>
          <div className="md:col-span-4 flex justify-end gap-2">
            <Link href="/transactions" className="btn btn-ghost">Clear</Link>
            <button type="submit" className="btn btn-primary">Apply filters</button>
          </div>
        </div>
      </form>

      <VirtualTable rows={rows} />
    </div>
  );
}
