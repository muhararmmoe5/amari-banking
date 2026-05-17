'use client';

import { X } from 'lucide-react';
import Portal from '@/components/Portal';
import SourceTraceContent from './SourceTraceContent';

export default function SourceTraceModal({ txId, onClose }: { txId: string; onClose: () => void }) {
  return (
    <Portal>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className="absolute top-0 right-0 bottom-0 w-[min(560px,100vw)] bg-bg-1 border-l border-line flex flex-col shadow-soft"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 bg-bg-1 border-b border-line px-5 py-3 flex items-center justify-between">
            <div className="text-sm font-medium">Source trace</div>
            <button onClick={onClose} className="text-ink-mute hover:text-ink p-1"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <SourceTraceContent txId={txId} />
          </div>
        </div>
      </div>
    </Portal>
  );
}
