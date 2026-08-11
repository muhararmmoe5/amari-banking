import Link from 'next/link';
import { listTransactions, portfolioSummary, flagCountsByEntity } from '@/lib/db/queries';
import { ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import type { EntityType } from '@/types';
import AuditClient from './AuditClient';

export const dynamic = 'force-dynamic';

interface SP {
  sev?: string;
  entity?: string;
  from?: string;
  to?: string;
  q?: string;
}

const ENTITY_ORDER: EntityType[] = [
  'AMARI_VENTURES',
  'BYTES_AI',
  'ROCKET_WIRELESS',
  'DELICIOUS_BYTES',
  'BYTES_REST_TECH',
  'PERSONAL',
  'BUSINESS_SHARED',
  'MULTI_ENTITY',
  'UNKNOWN',
];

function presetDates(preset?: string): { from: string; to: string } | null {
  if (!preset) return null;
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = fmt(today);
  switch (preset) {
    case '7d': { const d = new Date(); d.setDate(d.getDate() - 6); return { from: fmt(d), to }; }
    case '30d': { const d = new Date(); d.setDate(d.getDate() - 29); return { from: fmt(d), to }; }
    case '90d': { const d = new Date(); d.setDate(d.getDate() - 89); return { from: fmt(d), to }; }
    case 'mtd': { return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to }; }
    case 'ytd': { return { from: `${today.getFullYear()}-01-01`, to }; }
  }
  return null;
}

export default function AuditPage({ searchParams }: { searchParams: SP }) {
  const sev = searchParams.sev;
  const selectedEntity = (searchParams.entity || '') as EntityType | '';
  const dateFrom = searchParams.from || '';
  const dateTo = searchParams.to || '';
  const search = searchParams.q || '';

  let minScore = 1;
  let maxScore = 1000;
  if (sev === 'crit') { minScore = 80; maxScore = 1000; }
  else if (sev === 'high') { minScore = 60; maxScore = 79; }
  else if (sev === 'med') { minScore = 35; maxScore = 59; }

  const rows = listTransactions({
    flaggedOnly: true,
    orderBy: 'audit_score',
    limit: 500,
    entityTag: selectedEntity || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: search || undefined,
  });
  const filtered = rows.filter((r) => r.auditScore >= minScore && r.auditScore <= maxScore);

  const p = portfolioSummary();
  const reviewPct = p.totalCount > 0 ? Math.round((p.reviewedCount / p.totalCount) * 100) : 0;
  const entityCounts = flagCountsByEntity();
  const entitiesWithFlags = ENTITY_ORDER.filter((e) => (entityCounts[e] || 0) > 0);

  const activeFilterCount = [sev, selectedEntity, dateFrom, dateTo, search].filter(Boolean).length;

  // Carry current audit filters over to the bulk-review page so the same
  // scope of rows shows up in the Claude-powered pass. The bulk queue is
  // gated on PENDING_REVIEW, but audit-flagged rows overlap heavily.
  const bulkHref = '/transactions/bulk-review';

  return (
    <div style={{ padding: '24px 24px 100px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
              Banking / Audit review
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-.02em', color: 'var(--ink)' }}>
              <em style={{ fontFamily: 'var(--font-serif, "Instrument Serif", serif)', fontStyle: 'italic', color: 'var(--gold)', fontWeight: 400 }}>Audit</em>{' '}
              review
            </h1>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
              {p.openFlagCount} open flags · {p.reviewedCount} of {p.totalCount} tagged ({reviewPct}%)
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 999, marginTop: 10, maxWidth: 380, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--gold)', width: `${reviewPct}%` }} />
            </div>
          </div>
          <Link
            href={bulkHref}
            className="btn btn-primary"
            style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 3 L13.5 8.5 L19 10 L13.5 11.5 L12 17 L10.5 11.5 L5 10 L10.5 8.5 Z"/>
            </svg>
            Bulk auto-tag
          </Link>
        </div>
      </div>

      {/* Unified filter bar */}
      <form
        method="GET"
        style={{
          padding: '12px 14px', marginBottom: 12,
          background: 'var(--bg-1, #111114)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        }}
      >
        {/* Severity — a compact toggle group */}
        <FilterGroup label="Severity">
          <SegLink href={buildUrl({ sev: undefined, entity: selectedEntity, from: dateFrom, to: dateTo, q: search })} active={!sev} label={`All (${p.openFlagCount})`} />
          <SegLink href={buildUrl({ sev: 'crit', entity: selectedEntity, from: dateFrom, to: dateTo, q: search })} active={sev === 'crit'} label={`Critical ${p.criticalFlagCount}`} tone="crit" />
          <SegLink href={buildUrl({ sev: 'high', entity: selectedEntity, from: dateFrom, to: dateTo, q: search })} active={sev === 'high'} label={`High ${p.highFlagCount}`} tone="high" />
          <SegLink href={buildUrl({ sev: 'med', entity: selectedEntity, from: dateFrom, to: dateTo, q: search })} active={sev === 'med'} label={`Medium ${p.mediumFlagCount}`} tone="med" />
        </FilterGroup>

        <Divider />

        {/* Entity */}
        <FilterGroup label="Entity">
          <select
            name="entity"
            defaultValue={selectedEntity}
            style={filterInputStyle}
          >
            <option value="">All entities</option>
            {entitiesWithFlags.map((e) => (
              <option key={e} value={e}>{ENTITY_LABELS[e]} ({entityCounts[e] || 0})</option>
            ))}
          </select>
        </FilterGroup>

        <Divider />

        {/* Date range */}
        <FilterGroup label="Dates">
          <input type="date" name="from" defaultValue={dateFrom} style={filterInputStyle} />
          <span style={{ color: 'var(--ink-4, #44443f)', fontSize: 11 }}>→</span>
          <input type="date" name="to" defaultValue={dateTo} style={filterInputStyle} />
        </FilterGroup>
        <div style={{ display: 'flex', gap: 4 }}>
          <PresetLink label="7d" preset="7d" sev={sev} entity={selectedEntity} q={search} />
          <PresetLink label="30d" preset="30d" sev={sev} entity={selectedEntity} q={search} />
          <PresetLink label="MTD" preset="mtd" sev={sev} entity={selectedEntity} q={search} />
          <PresetLink label="YTD" preset="ytd" sev={sev} entity={selectedEntity} q={search} />
        </div>

        <Divider />

        {/* Search */}
        <FilterGroup label="Search">
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Merchant, description…"
            style={{ ...filterInputStyle, minWidth: 160 }}
          />
        </FilterGroup>

        {/* Preserve sev via hidden input so the form submit keeps it */}
        {sev ? <input type="hidden" name="sev" value={sev} /> : null}

        <div style={{ flex: 1 }} />

        <button type="submit" className="btn btn-primary btn-sm">Apply</button>
        {activeFilterCount > 0 ? (
          <Link href="/audit" className="btn btn-sm" style={{ color: 'var(--ink-3)' }}>
            Clear ({activeFilterCount})
          </Link>
        ) : null}
      </form>

      {/* Active-filter chips row — visual affirmation of what's applied */}
      {activeFilterCount > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, fontSize: 11 }}>
          {sev ? (
            <FilterChip
              label={`Severity: ${sev === 'crit' ? 'Critical' : sev === 'high' ? 'High' : 'Medium'}`}
              href={buildUrl({ sev: undefined, entity: selectedEntity, from: dateFrom, to: dateTo, q: search })}
            />
          ) : null}
          {selectedEntity ? (
            <FilterChip
              label={`Entity: ${ENTITY_LABELS[selectedEntity as EntityType]}`}
              href={buildUrl({ sev, entity: undefined, from: dateFrom, to: dateTo, q: search })}
            />
          ) : null}
          {dateFrom ? (
            <FilterChip
              label={`From ${dateFrom}`}
              href={buildUrl({ sev, entity: selectedEntity, from: undefined, to: dateTo, q: search })}
            />
          ) : null}
          {dateTo ? (
            <FilterChip
              label={`To ${dateTo}`}
              href={buildUrl({ sev, entity: selectedEntity, from: dateFrom, to: undefined, q: search })}
            />
          ) : null}
          {search ? (
            <FilterChip
              label={`Q: "${search}"`}
              href={buildUrl({ sev, entity: selectedEntity, from: dateFrom, to: dateTo, q: undefined })}
            />
          ) : null}
        </div>
      ) : null}

      {/* Result count */}
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 12 }}>
        Showing <b style={{ color: 'var(--ink-2)' }}>{filtered.length}</b> flagged transaction{filtered.length === 1 ? '' : 's'}
        {rows.length > filtered.length ? ` (${rows.length - filtered.length} hidden by severity)` : ''}
      </div>

      <AuditClient initialRows={filtered} />
    </div>
  );
}

// ── UI helpers ─────────────────────────────────────────────────────────────

const filterInputStyle: React.CSSProperties = {
  padding: '5px 8px',
  background: 'var(--bg-2, #16161a)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 6,
  fontSize: 11.5,
  color: 'var(--ink)',
  outline: 'none',
};

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-4, #44443f)', marginRight: 2 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.06)' }} />;
}

function SegLink({ href, active, label, tone }: { href: string; active: boolean; label: string; tone?: 'crit' | 'high' | 'med' }) {
  const toneColor = tone === 'crit' ? '#ff7676' : tone === 'high' ? '#ffa860' : tone === 'med' ? '#f0d060' : 'var(--gold)';
  return (
    <Link
      href={href}
      style={{
        padding: '4px 10px', fontSize: 11, borderRadius: 6,
        textDecoration: 'none',
        color: active ? 'var(--bg-1, #111114)' : 'var(--ink-2)',
        background: active ? toneColor : 'transparent',
        border: '1px solid ' + (active ? toneColor : 'rgba(255,255,255,0.06)'),
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </Link>
  );
}

function PresetLink({ label, preset, sev, entity, q }: { label: string; preset: string; sev?: string; entity?: string; q?: string }) {
  const dates = presetDates(preset);
  const href = buildUrl({ sev, entity, from: dates?.from, to: dates?.to, q });
  return (
    <Link
      href={href}
      style={{
        padding: '4px 8px', fontSize: 10.5, borderRadius: 6,
        textDecoration: 'none', color: 'var(--ink-3)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {label}
    </Link>
  );
}

function FilterChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="pill"
      style={{
        padding: '3px 9px', borderRadius: 999,
        color: 'var(--gold)',
        background: 'color-mix(in oklab, var(--gold) 10%, transparent)',
        border: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)',
        textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}
    >
      {label} <span style={{ opacity: 0.7 }}>×</span>
    </Link>
  );
}

function buildUrl(params: { sev?: string; entity?: string; from?: string; to?: string; q?: string }): string {
  const sp = new URLSearchParams();
  if (params.sev) sp.set('sev', params.sev);
  if (params.entity) sp.set('entity', params.entity);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  if (params.q) sp.set('q', params.q);
  const qs = sp.toString();
  return qs ? `/audit?${qs}` : '/audit';
}
