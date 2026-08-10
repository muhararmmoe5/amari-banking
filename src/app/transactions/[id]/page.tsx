import { redirect, notFound } from 'next/navigation';
import { requireUser, hasEditAccess } from '@/lib/auth';
import { getTransaction } from '@/lib/db/queries';
import { traceFundingSource, traceDownstreamFromInflow } from '@/lib/db/flow-trace';
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
  if (!hasEditAccess(user)) redirect('/cap');

  const tx = getTransaction(params.id);
  if (!tx) notFound();

  const acct = ACCOUNTS.find((a) => a.id === tx.accountId) || null;

  // Owner of this transaction (the entity/person that owns the money or
  // expense itself). Same derivation as ownerLabelFor but for the current row.
  const ownerEntity = (tx.confirmedEntity || tx.entityTag) as EntityType | null;
  const ownerEntityName = ownerEntity && ENTITY_LABELS[ownerEntity] ? ENTITY_LABELS[ownerEntity] : null;
  let txOwnerLabel: string | null = null;
  if (tx.individual && ownerEntityName) txOwnerLabel = `${tx.individual} · ${ownerEntityName}`;
  else if (tx.individual) txOwnerLabel = tx.individual;
  else if (ownerEntityName) txOwnerLabel = ownerEntityName;

  // Manual override wins over FIFO: if the user has explicitly linked this
  // expense to a funding inflow, surface that. Otherwise run the FIFO trace.
  let fifoSource: {
    txId: string; merchant: string; amount: number; accountId: string; date: string;
    isInternal: boolean; attributedAmount: number; ownerLabel: string | null;
  } | null = null;
  let sourceIsOverride = false;

  if (tx.amount < 0 && tx.fundedByTransactionId) {
    const linked = getTransaction(tx.fundedByTransactionId);
    if (linked) {
      fifoSource = {
        txId: linked.id,
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
        txId: topSource.txId,
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

  // For income transactions, trace forward to show which expenses this
  // inflow funded and how much is left.
  let downstream: {
    totalSpent: number; remaining: number; pctSpent: number;
    consumers: Array<{
      txId: string; date: string; merchant: string | null; description: string;
      amountFromThisInflow: number; expenseAmount: number;
    }>;
  } | null = null;
  if (tx.amount > 0) {
    const dt = traceDownstreamFromInflow(tx.id);
    if (dt) {
      downstream = {
        totalSpent: dt.totalSpent,
        remaining: dt.remaining,
        pctSpent: dt.pctSpent,
        consumers: dt.consumers.slice(0, 12).map((c) => ({
          txId: c.txId,
          date: c.postingDate,
          merchant: c.merchant,
          description: c.description,
          amountFromThisInflow: c.amountFromThisInflow,
          expenseAmount: c.expenseAmount,
        })),
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
      txOwnerLabel={txOwnerLabel}
      downstream={downstream}
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
