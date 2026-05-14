'use client';

import { useState, useTransition } from 'react';
import { Check, AlertCircle, XCircle } from 'lucide-react';
import { saveTransaction } from './transactions/actions';
import { useToast } from '@/components/Toast';

export default function AuditQueueActions({ txId }: { txId: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError } = useToast();

  function tag(status: 'CONFIRMED' | 'NEEDS_RECEIPT' | 'DISPUTED', label: string) {
    const id = saveStart();
    startTx(async () => {
      try {
        await saveTransaction(txId, { auditStatus: status });
        saveEnd(id);
        setDone(label);
      } catch (e: any) {
        saveError(id, e?.message);
      }
    });
  }

  if (done) {
    return <span className="text-[11px] text-ink-mute italic">{done}</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); tag('CONFIRMED', 'Confirmed'); }}
        title="Confirm"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-bg-2 hover:bg-bg-3 text-income border border-line transition"
      >
        <Check size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); tag('NEEDS_RECEIPT', 'Needs receipt'); }}
        title="Needs receipt"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-bg-2 hover:bg-bg-3 text-warn border border-line transition"
      >
        <AlertCircle size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); tag('DISPUTED', 'Disputed'); }}
        title="Dispute"
        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-bg-2 hover:bg-bg-3 text-expense border border-line transition"
      >
        <XCircle size={14} />
      </button>
    </div>
  );
}
