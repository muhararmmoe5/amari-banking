import Link from 'next/link';
import { requireUser, hasEditAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getCurrentBalances,
  listLargeInflows,
  type InflowEvent,
} from '@/lib/db/queries';
import { ACCOUNTS, ENTITY_COLORS } from '@/constants/accounts';
import { fmtMoney } from '@/lib/format';
import FlowList from './FlowList';

export const dynamic = 'force-dynamic';

interface SP { min?: string; account?: string; source?: string; from?: string; to?: string }

export default function FlowPage({ searchParams }: { searchParams: SP }) {
  const user = requireUser();
  if (!hasEditAccess(user)) redirect('/cap');

  const minAmount = parseInt(searchParams.min || '500', 10);
  const inflows: InflowEvent[] = listLargeInflows({
    minAmount: Math.max(0, Math.min(1_000_000, isNaN(minAmount) ? 500 : minAmount)),
    limit: 100,
    accountId: searchParams.account,
    incomeSource: searchParams.source,
    dateFrom: searchParams.from,
    dateTo: searchParams.to,
  });

  const balances = getCurrentBalances();
  const totalCash = Array.from(balances.values()).reduce((s, b) => s + b.balance, 0);

  const totalInflow = inflows.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="page-pad-mobile" style={{ padding: '24px 24px 100px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
          Banking / Money flow
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-.02em', color: 'var(--ink)' }}>
          <em style={{ fontFamily: 'var(--font-serif, "Instrument Serif", serif)', fontStyle: 'italic', color: 'var(--income)', fontWeight: 400 }}>Money in</em>
          {' → '}
          <em style={{ fontFamily: 'var(--font-serif, "Instrument Serif", serif)', fontStyle: 'italic', color: 'var(--gold)', fontWeight: 400 }}>where it went</em>
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5, maxWidth: 720 }}>
          Every inflow you received, expandable to see the exact expenses each dollar funded (FIFO trace).
          Add a <b style={{ color: 'var(--gold)' }}>custom tag</b> to any row to explain what it really is
          — e.g. tag a wire as <em style={{ fontStyle: 'italic' }}>&quot;Bytes AI investor wire — Omar tranche 2&quot;</em>
          and its $2,000 OpenAI charge as <em style={{ fontStyle: 'italic' }}>&quot;Bytes AI production API&quot;</em>.
          Then Claude can auto-fill the rest.
        </p>
      </div>

      {/* Balances + summary */}
      <div
        className="flow-stats-3col"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24,
        }}
      >
        <StatCard
          label="Total cash on hand"
          value={fmtMoney(totalCash)}
          tone={totalCash >= 0 ? 'income' : 'expense'}
          sub={`${balances.size} account${balances.size === 1 ? '' : 's'} with balances`}
        />
        <StatCard
          label="Inflows in view"
          value={fmtMoney(totalInflow)}
          tone="income"
          sub={`${inflows.length} inflow row${inflows.length === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Custom-tagged"
          value={`${inflows.filter((i) => i.customSourceTag).length} / ${inflows.length}`}
          tone="neutral"
          sub="inflows with a source tag"
        />
      </div>

      {/* Balances strip */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-4, #44443f)', marginBottom: 10 }}>
          Current balances by account
        </div>
        <div
          style={{
            display: 'grid', gap: 8,
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          }}
        >
          {ACCOUNTS.filter((a) => a.isActive).map((a) => {
            const b = balances.get(a.id);
            const balance = b?.balance ?? null;
            return (
              <Link
                key={a.id}
                href={`/transactions?account=${a.id}`}
                style={{
                  padding: 10, borderRadius: 8,
                  background: 'var(--bg-1, #111114)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  textDecoration: 'none', color: 'inherit',
                  display: 'block',
                }}
              >
                <div style={{ height: 2, background: ENTITY_COLORS[a.entity], borderRadius: 999, marginBottom: 8 }} />
                <div className="num" style={{ fontSize: 10, color: 'var(--ink-4, #44443f)' }}>····{a.last4}</div>
                <div className="truncate" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{a.label}</div>
                <div className="num" style={{
                  fontSize: 15, marginTop: 4,
                  color: balance == null ? 'var(--ink-4, #44443f)' : balance >= 0 ? 'var(--ink)' : 'var(--expense)',
                }}>
                  {balance != null ? fmtMoney(balance) : '—'}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Filter bar */}
      <form
        method="GET"
        style={{
          padding: '10px 12px', marginBottom: 12,
          background: 'var(--bg-1, #111114)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}
      >
        <FilterField label="Min $">
          <input name="min" type="number" min="0" step="100" defaultValue={searchParams.min || '500'} style={{ ...inputStyle, width: 90 }} />
        </FilterField>
        <Divider />
        <FilterField label="Account">
          <select name="account" defaultValue={searchParams.account || ''} style={inputStyle}>
            <option value="">Any</option>
            {ACCOUNTS.map((a) => <option key={a.id} value={a.id}>····{a.last4} — {a.label}</option>)}
          </select>
        </FilterField>
        <Divider />
        <FilterField label="Source">
          <select name="source" defaultValue={searchParams.source || ''} style={inputStyle}>
            <option value="">Any</option>
            <option value="SPACETEL">Spacetel</option>
            <option value="OMAR_ALGHAZALI">Omar Alghazali</option>
            <option value="TCETRA">TCETRA</option>
            <option value="STRIPE">Stripe</option>
            <option value="DOORDASH">DoorDash</option>
            <option value="GRUBHUB">Grubhub</option>
            <option value="ZELLE_IN">Zelle inbound</option>
            <option value="WIRE_UNKNOWN">Unknown wires</option>
          </select>
        </FilterField>
        <Divider />
        <FilterField label="From">
          <input name="from" type="date" defaultValue={searchParams.from || ''} style={inputStyle} />
        </FilterField>
        <FilterField label="To">
          <input name="to" type="date" defaultValue={searchParams.to || ''} style={inputStyle} />
        </FilterField>
        <div style={{ flex: 1 }} />
        <Link href="/flow" className="btn btn-sm">Clear</Link>
        <button type="submit" className="btn btn-primary btn-sm">Apply</button>
      </form>

      <FlowList inflows={inflows} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '5px 8px',
  background: 'var(--bg-2, #16161a)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 6,
  fontSize: 11.5,
  color: 'var(--ink)',
  outline: 'none',
};

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-4, #44443f)' }}>{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.06)' }} />;
}

function StatCard({ label, value, tone, sub }: {
  label: string; value: string; tone: 'income' | 'expense' | 'neutral'; sub: string;
}) {
  const color = tone === 'income' ? 'var(--income)' : tone === 'expense' ? 'var(--expense)' : 'var(--gold)';
  return (
    <div
      style={{
        padding: '14px 16px', borderRadius: 10,
        background: `linear-gradient(135deg, color-mix(in oklab, ${color} 5%, var(--bg-1, #111114)), var(--bg-1, #111114))`,
        border: `1px solid color-mix(in oklab, ${color} 20%, rgba(255,255,255,0.06))`,
      }}
    >
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--ink-3)' }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 500, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}
