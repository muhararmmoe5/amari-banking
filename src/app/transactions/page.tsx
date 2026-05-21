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
  // Balances are the per-row Chase truth as imported. No re-computation —
  // every previous attempt at synthesizing a running balance broke down
  // because same-day rows have no deterministic secondary sort, so any
  // walk-forward or walk-backward diverged from what Chase actually
  // reported. The imported balance is the bank's word at that moment.
  const rows = listTransactions(filters);
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

  const cells: Array<{ key: string; label: string; count: number; sub: string; color: string }> = [
    {
      key: 'all',
      label: 'All transactions',
      count: rows.length,
      sub: `${rows.length} of ${buckets.all.toLocaleString()} · matching filters`,
      color: 'var(--gold)',
    },
    {
      key: 'pending',
      label: 'Pending review',
      count: buckets.pending,
      sub: `${buckets.all > 0 ? Math.round((buckets.pending / buckets.all) * 100) : 0}% needs tagging`,
      color: 'var(--warn)',
    },
    {
      key: 'reviewed',
      label: 'Reviewed',
      count: buckets.reviewed,
      sub: 'awaiting CPA sign-off',
      color: '#7a9fc9',
    },
    {
      key: 'approved',
      label: 'Approved',
      count: buckets.approved,
      sub: 'CPA confirmed',
      color: 'var(--income)',
    },
    {
      key: 'escalations',
      label: 'Escalations',
      count: buckets.escalations,
      sub: buckets.escalations === 0 ? 'no critical issues' : 'flagged for verification',
      color: 'var(--expense)',
    },
  ];
  const activeTab = searchParams.review || 'pending';
  const activeKey = activeTab === 'pending' ? 'pending'
    : activeTab === 'reviewed' ? 'reviewed'
    : activeTab === 'approved' ? 'approved'
    : activeTab === 'escalations' ? 'escalations'
    : 'all';

  return (
    <div className="max-w-[1600px] mx-auto pb-12">
      {/* ── Page header ─────────────────────────────────────── */}
      <div
        className="flex items-end gap-5"
        style={{
          padding: '36px 36px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '.16em',
              color: 'var(--gold)',
              marginBottom: 10,
            }}
          >
            Banking · transactions
          </div>
          <h1
            style={{
              fontSize: 42,
              fontWeight: 500,
              letterSpacing: '-.03em',
              lineHeight: 1,
              margin: 0,
              color: 'var(--ink)',
            }}
          >
            <em
              style={{
                fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
                fontStyle: 'italic',
                fontWeight: 400,
                color: 'var(--gold)',
                fontSize: 48,
              }}
            >
              Trans
            </em>
            actions
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: 13,
              color: 'var(--ink-2, #b0afa6)',
              maxWidth: 540,
              lineHeight: 1.55,
            }}
          >
            <span className="num" style={{ color: 'var(--ink)', fontWeight: 500 }}>
              {buckets.all.toLocaleString()}
            </span>{' '}
            non-internal transactions across all institutions. Showing{' '}
            <span className="num" style={{ color: 'var(--ink)', fontWeight: 500 }}>
              {rows.length.toLocaleString()}
            </span>{' '}
            matching current filters.
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Link
            href={`/audit/deep${searchParams.account ? `?account=${searchParams.account}` : ''}`}
            className="btn"
          >
            Deep audit
          </Link>
          <RescanDatesButton />
          <Link
            href={`/transactions/new${searchParams.account ? `?account=${searchParams.account}` : ''}`}
            className="btn"
          >
            + Add
          </Link>
          <Link href="/import" className="btn btn-primary">
            Import more
          </Link>
        </div>
      </div>

      {/* ── Stat strip — clickable filter cells ────────────── */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr',
          background: 'var(--bg-1, #111114)',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
          position: 'relative',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, color-mix(in oklab, var(--gold) 30%, transparent), transparent)',
          }}
        />
        {cells.map((c) => {
          const isActive = c.key === activeKey;
          return (
            <Link
              key={c.key}
              href={reviewHref(c.key)}
              style={{
                padding: '18px 26px',
                borderRight: '1px solid rgba(255,255,255,0.055)',
                position: 'relative',
                cursor: 'pointer',
                background: isActive
                  ? `color-mix(in oklab, ${c.color} 4%, var(--bg-1, #111114))`
                  : 'transparent',
                boxShadow: isActive ? `inset 3px 0 0 ${c.color}` : 'none',
                transition: 'background 120ms ease',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '.16em',
                  color: isActive ? c.color : 'var(--ink-3)',
                  fontWeight: 500,
                }}
              >
                {c.label}
              </div>
              <div className="flex items-baseline" style={{ gap: 5, marginTop: 10 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
                    fontStyle: 'italic',
                    fontSize: 30,
                    lineHeight: 1,
                    color: isActive ? c.color : 'var(--ink)',
                  }}
                >
                  {c.count.toLocaleString()}
                </span>
                {c.key === 'all' ? (
                  <span style={{ fontSize: 13, color: 'var(--ink-2, #b0afa6)' }}>
                    of {buckets.all.toLocaleString()}
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
                {c.sub}
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── AI auto-trace strip ────────────────────────────── */}
      <div style={{ padding: '16px 36px 0' }}>
        <div
          className="flex items-center"
          style={{
            padding: '14px 18px',
            gap: 14,
            background: 'linear-gradient(90deg, color-mix(in oklab, var(--gold) 12%, var(--bg-1, #111114)) 0%, color-mix(in oklab, var(--gold) 4%, var(--bg-1, #111114)) 80%)',
            border: '1px solid color-mix(in oklab, var(--gold) 26%, rgba(255,255,255,0.055))',
            borderRadius: 12,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,122,.18), transparent 70%)',
              right: -60,
              top: -60,
              pointerEvents: 'none',
            }}
          />
          <div
            className="grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: 'color-mix(in oklab, var(--gold) 22%, var(--bg-2, #16161a))',
              border: '0.5px solid color-mix(in oklab, var(--gold) 40%, rgba(255,255,255,0.055))',
              color: 'var(--gold)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 0 14px -6px rgba(201,168,122,.4)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 L13.5 8.5 L19 10 L13.5 11.5 L12 17 L10.5 11.5 L5 10 L10.5 8.5 Z"/>
              <path d="M19 17 L19.7 19 L21.5 19.5 L19.7 20 L19 22 L18.3 20 L16.5 19.5 L18.3 19 Z"/>
            </svg>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, letterSpacing: '-.005em' }}>
              Let Amari{' '}
              <span
                style={{
                  fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
                  fontStyle: 'italic',
                  color: 'var(--gold)',
                }}
              >
                auto-trace
              </span>{' '}
              your unreviewed transactions
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2, #b0afa6)', marginTop: 3, lineHeight: 1.5 }}>
              AI will detect funding sources via FIFO, classify Personal vs Business, suggest entity + category — you review and override.{' '}
              <b style={{ color: 'var(--gold)' }}>
                ~{Math.max(1, Math.round(buckets.pending / 50))} min for {buckets.pending.toLocaleString()} transactions.
              </b>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <button type="button" className="btn btn-ghost btn-sm">Preview rules</button>
            <button type="button" className="btn btn-primary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M12 3 L13.5 8.5 L19 10 L13.5 11.5 L12 17 L10.5 11.5 L5 10 L10.5 8.5 Z"/>
              </svg>
              Auto-tag all
            </button>
          </div>
        </div>
      </div>

      {/* Filter form (existing functionality, restyled wrapper) */}
      <div style={{ padding: '16px 36px 8px' }}>

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
      </div>

      <div style={{ padding: '8px 36px 56px' }}>
        <VirtualTable rows={rows} />
      </div>
    </div>
  );
}
