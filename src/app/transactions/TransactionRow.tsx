'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Transaction } from '@/types';
import { ACCOUNTS, ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import { Money } from '@/components/Money';
import { EntityDot } from '@/components/EntityBadge';
import { FlagBadge } from '@/components/FlagBadge';
import { fmtDateShort, fmtMoney } from '@/lib/format';
import TransactionDetailDrawer from './TransactionDetailDrawer';

export const ROW_GRID = '92px 80px 1fr 120px 120px 150px 130px 130px 70px 100px 90px';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  UNREVIEWED: { bg: 'rgba(136,136,136,0.12)', text: '#A8A8A0' },
  TAGGED: { bg: 'rgba(96,200,240,0.12)', text: '#60C8F0' },
  CONFIRMED: { bg: 'rgba(34,197,94,0.12)', text: '#22C55E' },
  NEEDS_RECEIPT: { bg: 'rgba(239,68,68,0.12)', text: '#F87171' },
  PERSONAL_NO_DEDUCT: { bg: 'rgba(232,216,255,0.12)', text: '#D880FF' },
  DISPUTED: { bg: 'rgba(239,68,68,0.12)', text: '#F87171' },
};

export function TransactionRow({ tx }: { tx: Transaction }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const acct = ACCOUNTS.find((a) => a.id === tx.accountId);
  const bookedEntity = (tx.confirmedEntity || tx.entityTag) as keyof typeof ENTITY_LABELS;
  const entityColor = ENTITY_COLORS[bookedEntity] || '#888';
  const statusColors = STATUS_COLORS[tx.auditStatus] || STATUS_COLORS.UNREVIEWED;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setDetailOpen(true)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailOpen(true); } }}
      className="border-t border-line/60 hover:bg-bg-2/40 grid items-center text-sm cursor-pointer"
      style={{ gridTemplateColumns: ROW_GRID }}
    >
      <div className="px-3 py-2 mono text-xs whitespace-nowrap text-ink-dim">{fmtDateShort(tx.postingDate)}</div>
      <div className="px-3 py-2 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          {acct ? <EntityDot entity={acct.entity} /> : null}
          <span className="mono text-xs">···{tx.accountId}</span>
        </span>
      </div>
      <div className="px-3 py-2 min-w-0">
        <div className="text-sm truncate">{tx.merchantName}</div>
        <div className="text-[11px] text-ink-mute truncate">{tx.description}</div>
      </div>
      <div className="px-3 py-2 text-right whitespace-nowrap"><Money value={tx.amount} /></div>
      <div className="px-3 py-2 text-right whitespace-nowrap mono tabnum text-xs">
        {tx.balance != null ? (
          <span className={tx.balance < 0 ? 'text-expense' : 'text-ink-dim'}>{fmtMoney(tx.balance)}</span>
        ) : (
          <span className="text-ink-mute">—</span>
        )}
      </div>
      <div className="px-3 py-2 truncate">
        <span
          className="pill text-[10px]"
          style={{ background: `${entityColor}1f`, color: entityColor, border: `1px solid ${entityColor}40` }}
        >
          {ENTITY_LABELS[bookedEntity] || bookedEntity}
        </span>
      </div>
      <div className="px-3 py-2 text-xs text-ink-dim truncate">
        {tx.subCategory1 || <span className="text-ink-mute">—</span>}
      </div>
      <div className="px-3 py-2 truncate">
        <span
          className="pill text-[10px]"
          style={{ background: statusColors.bg, color: statusColors.text }}
        >
          {tx.auditStatus.replace(/_/g, ' ').toLowerCase()}
        </span>
      </div>
      <div className="px-3 py-2 text-center">
        {tx.cpaReviewed ? <Check size={14} className="text-income inline" /> : <span className="text-ink-mute">—</span>}
      </div>
      <div className="px-3 py-2 mono text-[11px] text-ink-dim whitespace-nowrap">
        {tx.taggedDate || <span className="text-ink-mute">—</span>}
      </div>
      <div className="px-3 py-2"><FlagBadge score={tx.auditScore} /></div>

      {detailOpen ? <TransactionDetailDrawer tx={tx} onClose={() => setDetailOpen(false)} /> : null}
    </div>
  );
}

