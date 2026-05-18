'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import type { Transaction } from '@/types';
import { ACCOUNTS, ENTITY_COLORS } from '@/constants/accounts';
import { Money } from '@/components/Money';
import { EntityBadge } from '@/components/EntityBadge';
import { FlagBadge } from '@/components/FlagBadge';
import { fmtDateShort, fmtMoney } from '@/lib/format';

export const ROW_GRID = '92px 100px 1fr 120px 120px 170px 140px 130px 70px 110px 90px';

interface StatusStyle {
  cls: 'conf' | 'unr' | 'rev' | 'esc' | 'low';
  label: string;
  color: string;
  rail: string | null;
}

function statusStyleFor(tx: Transaction): StatusStyle {
  if (tx.needsEscalation) {
    return { cls: 'esc', label: 'Escalation', color: '#d18876', rail: '#d18876' };
  }
  if (tx.reviewState === 'REVIEWED_APPROVED') {
    return { cls: 'conf', label: 'Approved', color: 'var(--income)', rail: 'var(--income)' };
  }
  if (tx.reviewState === 'REVIEWED') {
    return { cls: 'rev', label: 'Reviewed', color: '#7a9fc9', rail: '#7a9fc9' };
  }
  // Legacy audit_status hints
  if (tx.auditStatus === 'CONFIRMED') {
    return { cls: 'conf', label: 'Confirmed', color: 'var(--income)', rail: 'var(--income)' };
  }
  if (tx.auditStatus === 'NEEDS_RECEIPT') {
    return { cls: 'low', label: 'Needs receipt', color: 'var(--expense)', rail: null };
  }
  return { cls: 'unr', label: 'Pending', color: 'var(--warn)', rail: 'var(--warn)' };
}

export function TransactionRow({ tx }: { tx: Transaction }) {
  const [hover, setHover] = useState(false);
  const acct = ACCOUNTS.find((a) => a.id === tx.accountId);
  const bookedEntity = (tx.confirmedEntity || tx.entityTag) as keyof typeof ENTITY_COLORS;
  const acctColor = acct ? ENTITY_COLORS[acct.entity] : '#6f6e68';
  const status = statusStyleFor(tx);

  return (
    <Link
      href={`/transactions/${tx.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="grid items-center focus:outline-none"
      style={{
        gridTemplateColumns: ROW_GRID,
        borderTop: '1px solid rgba(255,255,255,0.055)',
        background: hover ? 'color-mix(in oklab, var(--gold) 3%, transparent)' : 'transparent',
        boxShadow: status.rail ? `inset 2px 0 0 ${status.rail}` : 'none',
        transition: 'background 120ms ease',
        fontSize: 12.5,
      }}
    >
      {/* Date */}
      <div className="px-4 py-3 num whitespace-nowrap" style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>
        <div>{fmtDateShort(tx.postingDate)}</div>
        {tx.transactionDate && tx.transactionDate !== tx.postingDate ? (
          <div className="text-[10px] mt-0.5 italic" style={{ color: 'var(--ink-4, #44443f)' }}>
            charged {fmtDateShort(tx.transactionDate)}
          </div>
        ) : null}
      </div>

      {/* Account chip */}
      <div className="px-3 py-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <span
            style={{
              width: 5, height: 5, borderRadius: 50,
              background: acctColor,
              boxShadow: `0 0 5px ${acctColor}`,
            }}
          />
          <span className="num" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
            ····{tx.accountId}
          </span>
        </span>
      </div>

      {/* Merchant / description */}
      <div className="px-3 py-3 min-w-0">
        <div style={{ color: 'var(--ink)', fontWeight: 500 }} className="truncate">
          {tx.merchantName || tx.description.slice(0, 60)}
        </div>
        <div
          className="num truncate"
          style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2, maxWidth: 340 }}
        >
          {tx.description}
        </div>
      </div>

      {/* Amount */}
      <div className="px-3 py-3 text-right whitespace-nowrap">
        <Money value={tx.amount} />
      </div>

      {/* Balance after */}
      <div className="px-3 py-3 text-right whitespace-nowrap num tabnum" style={{ fontSize: 12 }}>
        {tx.balance != null ? (
          <span style={{ color: tx.balance < 0 ? 'var(--expense)' : 'var(--ink-2)' }}>
            {fmtMoney(tx.balance)}
          </span>
        ) : (
          <span style={{ color: 'var(--ink-4, #44443f)' }}>—</span>
        )}
      </div>

      {/* Books to — EntityBadge */}
      <div className="px-3 py-3 truncate">
        <EntityBadge entity={bookedEntity} size="sm" />
      </div>

      {/* Sub-category */}
      <div className="px-3 py-3 truncate" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
        {tx.subCategory2 || tx.subCategory1 || <span style={{ color: 'var(--ink-4, #44443f)' }}>—</span>}
      </div>

      {/* Status */}
      <div className="px-3 py-3 truncate">
        <span
          className="inline-flex items-center"
          style={{
            gap: 5,
            padding: '3px 9px',
            borderRadius: 999,
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '.02em',
            border: `1px solid color-mix(in oklab, ${status.color} 28%, transparent)`,
            background: `color-mix(in oklab, ${status.color} 12%, transparent)`,
            color: status.color,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: 50, background: 'currentColor' }} />
          {status.label}
        </span>
      </div>

      {/* CPA */}
      <div className="px-3 py-3 text-center" style={{ fontSize: 11 }}>
        {tx.cpaReviewed ? (
          <span style={{ color: 'var(--income)' }}>✓</span>
        ) : (
          <span style={{ color: 'var(--ink-4, #44443f)' }}>—</span>
        )}
      </div>

      {/* Tagged date / AI tag chip */}
      <div className="px-3 py-3 num whitespace-nowrap" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
        {tx.taggedDate ? (
          tx.taggedDate
        ) : (
          <span
            className="inline-flex items-center gap-1"
            style={{
              opacity: hover ? 1 : 0,
              transition: 'opacity 120ms ease',
              fontSize: 10.5,
              color: 'var(--gold)',
              padding: '3px 8px',
              borderRadius: 6,
              border: '1px solid color-mix(in oklab, var(--gold) 26%, rgba(255,255,255,0.055))',
              background: 'color-mix(in oklab, var(--gold) 8%, rgba(255,255,255,0.02))',
            }}
          >
            <Sparkles size={9} />
            AI tag
          </span>
        )}
      </div>

      {/* Flag */}
      <div className="px-3 py-3"><FlagBadge score={tx.auditScore} /></div>
    </Link>
  );
}
