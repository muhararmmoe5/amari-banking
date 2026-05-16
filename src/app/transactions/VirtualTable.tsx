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
    <div className="card overflow-hidden">
      <div
        className="bg-bg-2 text-ink-dim text-xs grid items-center font-medium uppercase tracking-wider"
        style={{ gridTemplateColumns: ROW_GRID }}
      >
        <Cell className="text-center" title="Trace where this money came from">🔍</Cell>
        <Cell>Date</Cell>
        <Cell title="The Chase account this transaction posted on">Paid from</Cell>
        <Cell>Merchant / Description</Cell>
        <Cell className="text-right">Amount</Cell>
        <Cell className="text-right">Balance after</Cell>
        <Cell>Category</Cell>
        <Cell title="Which business this expense is booked to (independent of which account paid)">Books to entity</Cell>
        <Cell>Status</Cell>
        <Cell>Flag</Cell>
        <Cell>Purpose</Cell>
      </div>

      {rows.length === 0 ? (
        <div className="px-3 py-12 text-center text-ink-mute">No transactions match these filters.</div>
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
  return <div className={`px-3 py-2.5 ${className}`} title={title}>{children}</div>;
}
