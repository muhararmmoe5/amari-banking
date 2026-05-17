import { listBudgetsWithSpend } from '@/lib/db/budgets';
import { listCommitments, getPerson } from '@/lib/db/cap';
import { requireOwner } from '@/lib/auth';
import BudgetsClient from './BudgetsClient';

export const dynamic = 'force-dynamic';

export default function BudgetsPage() {
  requireOwner();
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
    };
  });
  return (
    <div className="p-8 space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <p className="text-sm text-ink-dim mt-1">
          Named buckets you can tag transactions to. Each budget tracks how much has been spent against it this month and all time. Link a budget to an investor commitment to track that month&apos;s tranche.
        </p>
      </div>
      <BudgetsClient initial={budgets} commitments={commitments} />
    </div>
  );
}
