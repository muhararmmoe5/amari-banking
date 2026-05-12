'use client';

import { useState, useTransition } from 'react';
import type { Transaction, EntityType, CategoryType, AuditStatus } from '@/types';
import { ACCOUNTS, ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import { Money } from '@/components/Money';
import { FlagBadge } from '@/components/FlagBadge';
import { EntityBadge } from '@/components/EntityBadge';
import { fmtDate } from '@/lib/format';
import { saveTransaction } from '../transactions/actions';

const ENTITY_OPTIONS: EntityType[] = [
  'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES',
  'BYTES_REST_TECH', 'PERSONAL', 'MULTI_ENTITY', 'BUSINESS_SHARED', 'UNKNOWN',
];

export function AuditCard({ tx, onTagged }: { tx: Transaction; onTagged?: () => void }) {
  const [, startTx] = useTransition();
  const [confirmedEntity, setConfirmedEntity] = useState(tx.confirmedEntity || tx.entityTag);
  const [purpose, setPurpose] = useState(tx.businessPurpose || '');
  const [docRef, setDocRef] = useState(tx.receiptRef || '');
  const acct = ACCOUNTS.find((a) => a.id === tx.accountId);

  function persist(patch: any) {
    startTx(async () => { await saveTransaction(tx.id, patch); });
  }

  function setStatus(status: AuditStatus) {
    startTx(async () => {
      await saveTransaction(tx.id, {
        auditStatus: status,
        confirmedEntity: confirmedEntity as EntityType,
        businessPurpose: purpose || null,
        receiptRef: docRef || null,
      });
      onTagged?.();
    });
  }

  return (
    <div id={tx.id} className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <FlagBadge score={tx.auditScore} />
          <span className="text-xs text-ink-mute mono">···{tx.accountId}</span>
          {acct ? <EntityBadge entity={acct.entity} size="xs" /> : null}
          <span className="text-xs text-ink-mute">{fmtDate(tx.postingDate)}</span>
        </div>
        <Money value={tx.amount} className="text-2xl" />
      </div>

      <div>
        <div className="font-medium">{tx.merchantName}</div>
        <div className="text-xs text-ink-mute mt-1">{tx.description}</div>
      </div>

      {tx.auditFlags.length > 0 ? (
        <div className="text-xs space-y-1 text-warn">
          {tx.auditFlags.map((f) => <div key={f}>⚠ {f.replace(/_/g, ' ')}</div>)}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Confirm entity</div>
          <select
            value={confirmedEntity}
            onChange={(e) => {
              const v = e.target.value as EntityType;
              setConfirmedEntity(v);
              persist({ confirmedEntity: v });
            }}
            className="w-full"
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o} value={o}>{ENTITY_LABELS[o]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Doc reference (invoice, receipt #)</div>
          <input
            type="text"
            value={docRef}
            onChange={(e) => setDocRef(e.target.value)}
            onBlur={() => persist({ receiptRef: docRef || null })}
            className="w-full"
            placeholder="INV-123 / link to file"
          />
        </label>
        <label className="block md:col-span-2">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Business purpose</div>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            onBlur={() => persist({ businessPurpose: purpose || null })}
            className="w-full"
            placeholder="What was this transaction for?"
          />
          {tx.businessPurpose ? null : (
            <div className="text-[11px] text-ink-mute mt-1">Suggestion: {tx.merchantName}</div>
          )}
        </label>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
        <button className="btn btn-primary" onClick={() => setStatus('CONFIRMED')}>✅ Confirm</button>
        <button className="btn" onClick={() => setStatus('NEEDS_RECEIPT')}>🔴 Needs receipt</button>
        <button className="btn" onClick={() => setStatus('PERSONAL_NO_DEDUCT')}>❌ Personal</button>
        <button className="btn btn-ghost text-ink-dim" onClick={() => onTagged?.()}>⏩ Skip</button>
      </div>
    </div>
  );
}
