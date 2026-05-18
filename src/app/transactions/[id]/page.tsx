import { redirect, notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getTransaction } from '@/lib/db/queries';
import { traceFundingSource } from '@/lib/db/flow-trace';
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
  const trace = tx.amount < 0 ? traceFundingSource(tx.id) : null;
  const topSource = trace?.sources?.[0] || null;

  return (
    <TransactionDetailView
      tx={tx}
      account={acct ? { id: acct.id, label: acct.label, entity: acct.entity, last4: acct.last4 } : null}
      fifoSource={topSource ? {
        merchant: topSource.merchant || topSource.description.slice(0, 60),
        amount: topSource.amount,
        accountId: topSource.accountId,
        date: topSource.date,
        isInternal: topSource.isInternal,
        attributedAmount: topSource.amount,
      } : null}
    />
  );
}
