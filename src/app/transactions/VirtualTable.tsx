'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Transaction } from '@/types';
import { TransactionRow, ROW_GRID } from './TransactionRow';

export default function VirtualTable({ rows }: { rows: Transaction[] }) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  return (
    <div
      style={{
        background: 'var(--bg-1, #111114)',
        border: '1px solid rgba(255,255,255,0.055)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: ROW_GRID,
          background: 'color-mix(in oklab, var(--gold) 2%, var(--bg-1, #111114))',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: '.16em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        <Cell>Date</Cell>
        <Cell title="The Chase account this transaction posted on">Account</Cell>
        <Cell>Merchant / Description</Cell>
        <Cell className="text-right">Amount</Cell>
        <Cell className="text-right" title="Account balance after this transaction posted — Chase's per-row truth. Filters can show gaps where in-between transactions are filtered out of view.">Balance after</Cell>
        <Cell title="Which entity this transaction is booked to">Books to</Cell>
        <Cell>Sub category</Cell>
        <Cell>Status</Cell>
        <Cell className="text-center" title="CPA reviewed">CPA</Cell>
        <Cell title="Tagged date">Tagged</Cell>
        <Cell>Flag</Cell>
      </div>

      {rows.length === 0 ? (
        <div className="px-3 py-16 text-center text-ink-mute">
          <div className="text-4xl mb-2 opacity-40">🔍</div>
          <div className="text-sm">No transactions match these filters.</div>
        </div>
      ) : (
        <div ref={parentRef} className="overflow-auto" style={{ height: 'min(72vh, 720px)' }}>
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const tx = rows[vi.index];
              return (
                <div
                  key={tx.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  <TransactionRow tx={tx} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ children, className = '', title }: { children: React.ReactNode; className?: string; title?: string }) {
  return <div className={`px-4 py-3 ${className}`} title={title}>{children}</div>;
}
