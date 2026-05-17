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
        className="surface-glass border-b border-line text-ink-mute text-2xs grid items-center font-semibold uppercase tracking-[0.06em]"
        style={{ gridTemplateColumns: ROW_GRID }}
      >
        <Cell>Date</Cell>
        <Cell title="The Chase account this transaction posted on">Paid from</Cell>
        <Cell>Merchant / Description</Cell>
        <Cell className="text-right">Amount</Cell>
        <Cell className="text-right" title="Chase's reported account balance immediately after this transaction posted. If you've hidden internal transfers, the chain row-to-row may have gaps where internal transfers happened — toggle 'Show internal' to see those.">Balance after</Cell>
        <Cell title="Which business this expense is booked to">Books to</Cell>
        <Cell>Sub category</Cell>
        <Cell>Status</Cell>
        <Cell className="text-center" title="CPA reviewed">CPA</Cell>
        <Cell title="Tagged date">Tagged date</Cell>
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
  return <div className={`px-3 py-2.5 ${className}`} title={title}>{children}</div>;
}
