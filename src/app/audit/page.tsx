import Link from 'next/link';
import { listTransactions, portfolioSummary } from '@/lib/db/queries';
import AuditClient from './AuditClient';

export const dynamic = 'force-dynamic';

interface SP { sev?: string }

export default function AuditPage({ searchParams }: { searchParams: SP }) {
  const sev = searchParams.sev;
  let minScore = 1;
  let maxScore = 1000;
  if (sev === 'crit') { minScore = 80; maxScore = 1000; }
  else if (sev === 'high') { minScore = 60; maxScore = 79; }
  else if (sev === 'med') { minScore = 35; maxScore = 59; }
  const rows = listTransactions({ flaggedOnly: true, orderBy: 'audit_score', limit: 200 });
  const filtered = rows.filter((r) => r.auditScore >= minScore && r.auditScore <= maxScore);
  const p = portfolioSummary();
  const reviewPct = p.totalCount > 0 ? Math.round((p.reviewedCount / p.totalCount) * 100) : 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit review</h1>
        <p className="text-sm text-ink-dim mt-1">
          {p.openFlagCount} open flags · {p.reviewedCount} of {p.totalCount} tagged ({reviewPct}%)
        </p>
        <div className="h-1.5 bg-bg-2 rounded mt-3 overflow-hidden max-w-md">
          <div className="h-full bg-entity-bytes" style={{ width: `${reviewPct}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Tab href="/audit" active={!sev} label={`All (${p.openFlagCount})`} />
        <Tab href="/audit?sev=crit" active={sev === 'crit'} label={`🔴 Critical (${p.criticalFlagCount})`} />
        <Tab href="/audit?sev=high" active={sev === 'high'} label={`🟠 High (${p.highFlagCount})`} />
        <Tab href="/audit?sev=med" active={sev === 'med'} label={`🟡 Medium (${p.mediumFlagCount})`} />
      </div>

      <AuditClient initialRows={filtered} />
    </div>
  );
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
