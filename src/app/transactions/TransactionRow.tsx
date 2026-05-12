'use client';

import { useState, useTransition } from 'react';
import type { Transaction, EntityType, AuditStatus } from '@/types';
import { ACCOUNTS, ENTITY_LABELS } from '@/constants/accounts';
import { Money } from '@/components/Money';
import { EntityDot } from '@/components/EntityBadge';
import { FlagBadge } from '@/components/FlagBadge';
import { fmtDateShort } from '@/lib/format';
import { saveTransaction } from './actions';
import { useToast } from '@/components/Toast';

const ENTITY_OPTIONS: EntityType[] = [
  'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES',
  'BYTES_REST_TECH', 'PERSONAL', 'MULTI_ENTITY', 'BUSINESS_SHARED', 'UNKNOWN',
];

const STATUS_OPTIONS: AuditStatus[] = [
  'UNREVIEWED', 'TAGGED', 'CONFIRMED', 'NEEDS_RECEIPT', 'PERSONAL_NO_DEDUCT', 'DISPUTED',
];

export const ROW_GRID = '92px 80px 1fr 120px 140px 160px 160px 110px 220px';

export function TransactionRow({ tx }: { tx: Transaction }) {
  const [, startTx] = useTransition();
  const [confirmedEntity, setConfirmedEntity] = useState<string>(tx.confirmedEntity || '');
  const [status, setStatus] = useState<string>(tx.auditStatus);
  const [purpose, setPurpose] = useState<string>(tx.businessPurpose || '');
  const acct = ACCOUNTS.find((a) => a.id === tx.accountId);
  const { saveStart, saveEnd, saveError } = useToast();

  function persist(patch: any) {
    const id = saveStart();
    startTx(async () => {
      try {
        await saveTransaction(tx.id, patch);
        saveEnd(id);
      } catch (e: any) {
        saveError(id, e?.message);
      }
    });
  }

  return (
    <div
      className="border-t border-line/60 hover:bg-bg-2/40 grid items-center text-sm"
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
      <div className="px-3 py-2 text-xs text-ink-dim whitespace-nowrap truncate">
        {tx.isInternal
          ? <span className="pill bg-bg-3 text-ink-dim">Internal</span>
          : tx.category.replace(/^(EXPENSE_|INCOME_)/, '').replace(/_/g, ' ')}
      </div>
      <div className="px-3 py-2">
        <select
          className="text-xs w-full"
          value={confirmedEntity}
          onChange={(e) => { setConfirmedEntity(e.target.value); persist({ confirmedEntity: e.target.value || null }); }}
        >
          <option value="">auto: {ENTITY_LABELS[tx.entityTag]}</option>
          {ENTITY_OPTIONS.map((o) => (
            <option key={o} value={o}>{ENTITY_LABELS[o]}</option>
          ))}
        </select>
      </div>
      <div className="px-3 py-2">
        <select
          className="text-xs w-full"
          value={status}
          onChange={(e) => { setStatus(e.target.value); persist({ auditStatus: e.target.value }); }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
          ))}
        </select>
      </div>
      <div className="px-3 py-2"><FlagBadge score={tx.auditScore} /></div>
      <div className="px-3 py-2">
        <input
          type="text"
          className="text-xs w-full"
          placeholder="Business purpose…"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          onBlur={() => persist({ businessPurpose: purpose || null })}
        />
      </div>
    </div>
  );
}
