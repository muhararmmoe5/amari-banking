import { redirect, notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getTransaction } from '@/lib/db/queries';
import { traceFundingSource } from '@/lib/db/flow-trace';
import { listSplits } from '@/lib/db/splits';
import { ACCOUNTS } from '@/constants/accounts';
import TransactionDetailView from './TransactionDetailView';

export const dynamic = 'force-dynamic';

interface Props { params: { id: string } }

export default function TransactionDetailPage({ params }: Props) {
  const user = requireUser();
  if (user.role !== 'OWNER') redirect('/cap');

  const tx = getTransaction(params.id);
  if (!tx) notFound();

  const acct = ACCOUNTS.find((a) => a.id === tx.accountId) || null;

  // Manual override wins over FIFO: if the user has explicitly linked this
  // expense to a funding inflow, surface that. Otherwise run the FIFO trace.
  let fifoSource: {
    merchant: string; amount: number; accountId: string; date: string;
    isInternal: boolean; attributedAmount: number;
  } | null = null;
  let sourceIsOverride = false;

  if (tx.amount < 0 && tx.fundedByTransactionId) {
    const linked = getTransaction(tx.fundedByTransactionId);
    if (linked) {
      fifoSource = {
        merchant: linked.merchantName || linked.description.slice(0, 60),
        amount: linked.amount,
        accountId: linked.accountId,
        date: linked.postingDate,
        isInternal: !!linked.isInternal,
        attributedAmount: Math.min(linked.amount, Math.abs(tx.amount)),
      };
      sourceIsOverride = true;
    }
  }
  if (!fifoSource && tx.amount < 0) {
    const trace = traceFundingSource(tx.id);
    const topSource = trace?.sources?.[0] || null;
    if (topSource) {
      fifoSource = {
        merchant: topSource.merchant || topSource.description.slice(0, 60),
        amount: topSource.amount,
        accountId: topSource.accountId,
        date: topSource.date,
        isInternal: topSource.isInternal,
        attributedAmount: topSource.amount,
      };
    }
  }

  const splits = listSplits(tx.id);

  return (
    <TransactionDetailView
      tx={tx}
      account={acct ? { id: acct.id, label: acct.label, entity: acct.entity, last4: acct.last4 } : null}
      fifoSource={fifoSource}
      sourceIsOverride={sourceIsOverride}
      initialSplitCount={splits.length}
      initialSplitSummary={splits.map((s) => ({
        id: s.id,
        amountCents: s.amountCents,
        entity: s.entity,
        subCategory1: s.subCategory1,
        subCategory2: s.subCategory2,
        individual: s.individual,
        notes: s.notes,
      }))}
    />
  );
}
