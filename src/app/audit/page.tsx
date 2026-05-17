import Link from 'next/link';
import { listTransactions, portfolioSummary, flagCountsByEntity } from '@/lib/db/queries';
import { ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import type { EntityType } from '@/types';
import AuditClient from './AuditClient';

export const dynamic = 'force-dynamic';

interface SP {
  sev?: string;
  entity?: string;
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

export default function AuditPage({ searchParams }: { searchParams: SP }) {
  const sev = searchParams.sev;
  const selectedEntity = (searchParams.entity || '') as EntityType | '';

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
  });
  const filtered = rows.filter((r) => r.auditScore >= minScore && r.auditScore <= maxScore);
  const p = portfolioSummary();
  const reviewPct = p.totalCount > 0 ? Math.round((p.reviewedCount / p.totalCount) * 100) : 0;
  const entityCounts = flagCountsByEntity();
  const entitiesWithFlags = ENTITY_ORDER.filter((e) => (entityCounts[e] || 0) > 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit review</h1>
        <p className="text-sm text-ink-dim mt-1">
          {p.openFlagCount} open flags · {p.reviewedCount} of {p.totalCount} tagged ({reviewPct}%)
        </p>
        <div className="h-1.5 bg-bg-2 rounded mt-3 overflow-hidden max-w-md">
          <div className="h-full bg-entity-bytes" style={{ width: `${reviewPct}%` }} />
        </div>
      </div>

      {/* Entity filter row */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2">Filter by entity</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <EntityPill
            href={buildUrl({ sev, entity: undefined })}
            active={!selectedEntity}
            label={`All entities (${p.openFlagCount})`}
            color="#888888"
          />
          {entitiesWithFlags.map((e) => (
            <EntityPill
              key={e}
              href={buildUrl({ sev, entity: e })}
              active={selectedEntity === e}
              label={`${ENTITY_LABELS[e]} (${entityCounts[e] || 0})`}
              color={ENTITY_COLORS[e]}
            />
          ))}
        </div>
      </div>

      {/* Severity filter row */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2">Filter by severity</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Tab
            href={buildUrl({ sev: undefined, entity: selectedEntity || undefined })}
            active={!sev}
            label={`All`}
          />
          <Tab
            href={buildUrl({ sev: 'crit', entity: selectedEntity || undefined })}
            active={sev === 'crit'}
            label={`🔴 Critical (${p.criticalFlagCount})`}
          />
          <Tab
            href={buildUrl({ sev: 'high', entity: selectedEntity || undefined })}
            active={sev === 'high'}
            label={`🟠 High (${p.highFlagCount})`}
          />
          <Tab
            href={buildUrl({ sev: 'med', entity: selectedEntity || undefined })}
            active={sev === 'med'}
            label={`🟡 Medium (${p.mediumFlagCount})`}
          />
        </div>
      </div>

      <AuditClient initialRows={filtered} />
    </div>
  );
}

function buildUrl(params: { sev?: string; entity?: string }): string {
  const sp = new URLSearchParams();
  if (params.sev) sp.set('sev', params.sev);
  if (params.entity) sp.set('entity', params.entity);
  const qs = sp.toString();
  return qs ? `/audit?${qs}` : '/audit';
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`pill ${active ? 'bg-entity-bytes text-bg-0 border-entity-bytes' : 'bg-bg-2 text-ink-dim border-line'} border`}
    >
      {label}
    </Link>
  );
}

function EntityPill({ href, active, label, color }: { href: string; active: boolean; label: string; color: string }) {
  return (
    <Link
      href={href}
      className="pill border transition"
      style={
        active
          ? { background: color, color: '#0C0C0E', borderColor: color, fontWeight: 600 }
          : { background: `${color}1f`, color, borderColor: `${color}40` }
      }
    >
      {label}
    </Link>
  );
}
