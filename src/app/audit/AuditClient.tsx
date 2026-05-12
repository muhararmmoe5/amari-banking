'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { Transaction, AuditStatus, EntityType } from '@/types';
import { ACCOUNTS, ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import { Money } from '@/components/Money';
import { FlagBadge } from '@/components/FlagBadge';
import { EntityBadge } from '@/components/EntityBadge';
import { fmtDate } from '@/lib/format';
import { saveTransaction } from '../transactions/actions';
import { useToast } from '@/components/Toast';

const ENTITY_OPTIONS: EntityType[] = [
  'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES',
  'BYTES_REST_TECH', 'PERSONAL', 'MULTI_ENTITY', 'BUSINESS_SHARED', 'UNKNOWN',
];

export default function AuditClient({ initialRows }: { initialRows: Transaction[] }) {
  const [rows, setRows] = useState(initialRows);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError } = useToast();
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const active = rows[activeIdx];

  // Scroll active into view
  useEffect(() => {
    const el = cardsRef.current[activeIdx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx]);

  function setStatus(tx: Transaction, status: AuditStatus) {
    const toastId = saveStart();
    const idx = rows.findIndex((r) => r.id === tx.id);
    startTx(async () => {
      try {
        await saveTransaction(tx.id, { auditStatus: status });
        saveEnd(toastId);
        // Remove from queue and advance
        setRows((cur) => cur.filter((r) => r.id !== tx.id));
        setActiveIdx((i) => Math.min(i, Math.max(0, rows.length - 2)));
        if (idx >= 0) {
          // already removed by filter; activeIdx will be capped above
        }
      } catch (e: any) {
        saveError(toastId, e?.message);
      }
    });
  }

  function persistField(tx: Transaction, patch: any) {
    const toastId = saveStart();
    startTx(async () => {
      try {
        await saveTransaction(tx.id, patch);
        saveEnd(toastId);
      } catch (e: any) {
        saveError(toastId, e?.message);
      }
    });
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (!active) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); setShowHelp((s) => !s); return; }
      if (e.key === 'Escape') { setShowHelp(false); return; }
      if (e.key === '1') { e.preventDefault(); setStatus(active, 'CONFIRMED'); }
      else if (e.key === '2') { e.preventDefault(); setStatus(active, 'NEEDS_RECEIPT'); }
      else if (e.key === '3') { e.preventDefault(); setStatus(active, 'PERSONAL_NO_DEDUCT'); }
      else if (e.key === '4') { e.preventDefault(); setActiveIdx((i) => Math.min(rows.length - 1, i + 1)); }
      else if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); setActiveIdx((i) => Math.min(rows.length - 1, i + 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, rows.length]);

  if (rows.length === 0) {
    return <div className="card p-12 text-center text-ink-mute">All clear in this bucket 🎉</div>;
  }

  return (
    <div>
      <div className="text-xs text-ink-dim mb-3 flex items-center justify-between">
        <div>
          Card <span className="text-ink mono">{Math.min(activeIdx + 1, rows.length)}</span> of <span className="mono">{rows.length}</span>
        </div>
        <button type="button" onClick={() => setShowHelp(true)} className="btn btn-ghost text-xs">
          <kbd>?</kbd> shortcuts
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {rows.map((tx, idx) => (
          <Card
            key={tx.id}
            tx={tx}
            isActive={idx === activeIdx}
            innerRef={(el) => { cardsRef.current[idx] = el; }}
            onClick={() => setActiveIdx(idx)}
            onStatus={(s) => setStatus(tx, s)}
            onPersist={(p) => persistField(tx, p)}
          />
        ))}
      </div>

      {/* Sticky hint bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 card px-4 py-2 flex items-center gap-3 text-xs text-ink-dim">
        <span><kbd>1</kbd> Confirm</span>
        <span><kbd>2</kbd> Needs receipt</span>
        <span><kbd>3</kbd> Personal</span>
        <span><kbd>4</kbd> Skip</span>
        <span className="opacity-60">·</span>
        <span><kbd>←</kbd> <kbd>→</kbd> Navigate</span>
        <span className="opacity-60">·</span>
        <span><kbd>?</kbd> Help</span>
      </div>

      {showHelp ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="card p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Keyboard shortcuts</h3>
              <button onClick={() => setShowHelp(false)} className="btn btn-ghost">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div><kbd>1</kbd> Confirm ✅</div><div className="text-ink-dim">Mark CONFIRMED</div>
              <div><kbd>2</kbd> Needs receipt 🔴</div><div className="text-ink-dim">Flag for documentation</div>
              <div><kbd>3</kbd> Personal ❌</div><div className="text-ink-dim">Not deductible</div>
              <div><kbd>4</kbd> Skip ⏩</div><div className="text-ink-dim">Move on without tagging</div>
              <div><kbd>←</kbd> <kbd>→</kbd> / <kbd>j</kbd> <kbd>k</kbd></div><div className="text-ink-dim">Navigate cards</div>
              <div><kbd>?</kbd></div><div className="text-ink-dim">Toggle this help</div>
              <div><kbd>Esc</kbd></div><div className="text-ink-dim">Close / unfocus input</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Card({
  tx, isActive, innerRef, onClick, onStatus, onPersist,
}: {
  tx: Transaction;
  isActive: boolean;
  innerRef: (el: HTMLDivElement | null) => void;
  onClick: () => void;
  onStatus: (s: AuditStatus) => void;
  onPersist: (p: any) => void;
}) {
  const [confirmedEntity, setConfirmedEntity] = useState<EntityType>(tx.confirmedEntity || tx.entityTag);
  const [purpose, setPurpose] = useState(tx.businessPurpose || '');
  const [docRef, setDocRef] = useState(tx.receiptRef || '');
  const acct = ACCOUNTS.find((a) => a.id === tx.accountId);

  return (
    <div
      id={tx.id}
      ref={innerRef}
      onClick={onClick}
      className={`card p-5 space-y-4 cursor-pointer transition ${isActive ? 'ring-2 ring-entity-bytes border-entity-bytes/60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <FlagBadge score={tx.auditScore} />
          <span className="text-xs text-ink-mute mono">···{tx.accountId}</span>
          {acct ? <EntityBadge entity={acct.entity} size="xs" /> : null}
          <span className="text-xs text-ink-mute">{fmtDate(tx.postingDate)}</span>
        </div>
        <Money value={tx.amount} className="text-2xl" />
      </div>
      <div>
        <div className="font-medium">{tx.merchantName}</div>
        <div className="text-xs text-ink-mute mt-1 break-all">{tx.description}</div>
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
            onChange={(e) => { const v = e.target.value as EntityType; setConfirmedEntity(v); onPersist({ confirmedEntity: v }); }}
            className="w-full"
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o} value={o}>{ENTITY_LABELS[o]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Doc reference</div>
          <input
            type="text"
            value={docRef}
            onChange={(e) => setDocRef(e.target.value)}
            onBlur={() => onPersist({ receiptRef: docRef || null })}
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
            onBlur={() => onPersist({ businessPurpose: purpose || null })}
            className="w-full"
            placeholder="What was this transaction for?"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
        <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); onStatus('CONFIRMED'); }}>
          <kbd>1</kbd> ✅ Confirm
        </button>
        <button className="btn" onClick={(e) => { e.stopPropagation(); onStatus('NEEDS_RECEIPT'); }}>
          <kbd>2</kbd> 🔴 Needs receipt
        </button>
        <button className="btn" onClick={(e) => { e.stopPropagation(); onStatus('PERSONAL_NO_DEDUCT'); }}>
          <kbd>3</kbd> ❌ Personal
        </button>
      </div>
    </div>
  );
}
