import { redirect, notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { getTransaction } from '@/lib/db/queries';
import { traceFundingSource } from '@/lib/db/flow-trace';
import { listSplits } from '@/lib/db/splits';
import { ACCOUNTS, ENTITY_LABELS } from '@/constants/accounts';
import TransactionDetailView from './TransactionDetailView';
import type { EntityType } from '@/types';

export const dynamic = 'force-dynamic';

interface Props { params: { id: string } }

function ownerLabelFor(sourceTxId: string): string | null {
  const t = getTransaction(sourceTxId);
  if (!t) return null;
  const entity = (t.confirmedEntity || t.entityTag) as EntityType | null;
  const entityName = entity && ENTITY_LABELS[entity] ? ENTITY_LABELS[entity] : null;
  if (t.individual && entityName) return `${t.individual} · ${entityName}`;
  if (t.individual) return t.individual;
  if (entityName) return entityName;
  return null;
}

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
    isInternal: boolean; attributedAmount: number; ownerLabel: string | null;
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
        ownerLabel: ownerLabelFor(linked.id),
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
        ownerLabel: ownerLabelFor(topSource.txId),
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
