import { listBudgetsWithSpend } from '@/lib/db/budgets';
import { requireOwner } from '@/lib/auth';
import BudgetsClient from './BudgetsClient';

export const dynamic = 'force-dynamic';

export default function BudgetsPage() {
  requireOwner();
  const budgets = listBudgetsWithSpend();
  return (
    <div className="p-8 space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <p className="text-sm text-ink-dim mt-1">
          Named buckets you can tag transactions to. Each budget tracks how much has been spent against it this month and all time.
        </p>
      </div>
      <BudgetsClient initial={budgets} />
    </div>
  );
}
