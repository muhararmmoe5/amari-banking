import { listBudgetsWithSpend, listFounderAllowancesWithUsage } from '@/lib/db/budgets';
import { listCommitments, getPerson, listPeople } from '@/lib/db/cap';
import { requireUser, hasEditAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BUSINESS_ENTITIES, ENTITY_LABELS } from '@/constants/accounts';
import BudgetsClient from './BudgetsClient';
import FounderAllowancesSection from './FounderAllowancesSection';

export const dynamic = 'force-dynamic';

export default function BudgetsPage() {
  const user = requireUser();
  if (!hasEditAccess(user)) redirect('/cap');
  const budgets = listBudgetsWithSpend();
  const commitments = listCommitments().filter((c) => c.status === 'ACTIVE').map((c) => {
    const person = getPerson(c.personId);
    const parts = [person?.name || 'Unknown'];
    if (c.monthlyAmountCents) parts.push(`$${(c.monthlyAmountCents / 100).toLocaleString()}/mo`);
    if (c.equityPercent != null) parts.push(`${c.equityPercent}%`);
    parts.push(`→ ${c.entity.replace(/_/g, ' ').toLowerCase()}`);
    return {
      id: c.id,
      label: parts.join(' · '),
      entity: c.entity,
      monthlyAmountCents: c.monthlyAmountCents,
      personId: c.personId,
      personName: person?.name || null,
    };
  });
  const people = listPeople().map((p) => ({ id: p.id, name: p.name }));
  const founderAllowances = listFounderAllowancesWithUsage();
  const entityOptions = BUSINESS_ENTITIES.map((e) => ({ value: e, label: ENTITY_LABELS[e] }));
  return (
    <div className="p-8 space-y-8 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Budgets</h1>
        <p className="text-sm text-ink-dim mt-2 max-w-2xl">
          Named buckets you can tag transactions to. Each budget tracks how much has been spent against it this month and all time. Link a budget to an investor commitment to track that month&apos;s tranche.
        </p>
      </div>
      <FounderAllowancesSection
        allowances={founderAllowances}
        people={people}
        entityOptions={entityOptions}
      />
      <BudgetsClient initial={budgets} commitments={commitments} people={people} />
    </div>
  );
}
