'use client';

import { useState, useTransition } from 'react';
import type { Transaction, EntityType, CategoryType, AuditStatus } from '@/types';
import { ACCOUNTS, ENTITY_LABELS } from '@/constants/accounts';
import { Money } from '@/components/Money';
import { EntityDot } from '@/components/EntityBadge';
import { FlagBadge } from '@/components/FlagBadge';
import { fmtDateShort } from '@/lib/format';
import { saveTransaction } from './actions';

const ENTITY_OPTIONS: EntityType[] = [
  'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES',
  'BYTES_REST_TECH', 'PERSONAL', 'MULTI_ENTITY', 'BUSINESS_SHARED', 'UNKNOWN',
];

const STATUS_OPTIONS: AuditStatus[] = [
  'UNREVIEWED', 'TAGGED', 'CONFIRMED', 'NEEDS_RECEIPT', 'PERSONAL_NO_DEDUCT', 'DISPUTED',
];

export function TransactionRow({ tx }: { tx: Transaction }) {
  const [, startTx] = useTransition();
  const [confirmedEntity, setConfirmedEntity] = useState<string>(tx.confirmedEntity || '');
  const [status, setStatus] = useState<string>(tx.auditStatus);
  const [purpose, setPurpose] = useState<string>(tx.businessPurpose || '');
  const acct = ACCOUNTS.find((a) => a.id === tx.accountId);

  function persist(patch: any) {
    startTx(async () => {
      await saveTransaction(tx.id, patch);
    });
  }

  return (
    <tr className="border-t border-line/60 hover:bg-bg-2/40">
      <td className="px-3 py-2 mono text-xs whitespace-nowrap text-ink-dim">{fmtDateShort(tx.postingDate)}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          {acct ? <EntityDot entity={acct.entity} /> : null}
          <span className="mono text-xs">···{tx.accountId}</span>
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="text-sm truncate max-w-[380px]">{tx.merchantName}</div>
        <div className="text-[11px] text-ink-mute truncate max-w-[380px]">{tx.description}</div>
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap"><Money value={tx.amount} /></td>
      <td className="px-3 py-2 text-xs text-ink-dim whitespace-nowrap">
        {tx.isInternal ? <span className="pill bg-bg-3 text-ink-dim">Internal</span> : tx.category.replace(/^(EXPENSE_|INCOME_)/, '').replace(/_/g, ' ')}
      </td>
      <td className="px-3 py-2">
        <select
          className="text-xs"
          value={confirmedEntity}
          onChange={(e) => { setConfirmedEntity(e.target.value); persist({ confirmedEntity: e.target.value || null }); }}
        >
          <option value="">(auto: {ENTITY_LABELS[tx.entityTag]})</option>
          {ENTITY_OPTIONS.map((o) => (
            <option key={o} value={o}>{ENTITY_LABELS[o]}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          className="text-xs"
          value={status}
          onChange={(e) => { setStatus(e.target.value); persist({ auditStatus: e.target.value }); }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2"><FlagBadge score={tx.auditScore} /></td>
      <td className="px-3 py-2">
        <input
          type="text"
          className="text-xs w-48"
          placeholder="Business purpose…"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          onBlur={() => persist({ businessPurpose: purpose || null })}
        />
      </td>
    </tr>
  );
}
