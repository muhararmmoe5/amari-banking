'use client';

import { useEffect, useState, useTransition } from 'react';
import { X, Search, Check } from 'lucide-react';
import type { Transaction, EntityType, AuditStatus } from '@/types';
import { ACCOUNTS, ENTITY_LABELS, ENTITY_COLORS, getAccount } from '@/constants/accounts';
import { fmtMoney, fmtDate } from '@/lib/format';
import { saveTransaction } from './actions';
import { useToast } from '@/components/Toast';
import SplitEditor from '../audit/SplitEditor';
import SourceTraceModal from './SourceTraceModal';
import Portal from '@/components/Portal';

const ENTITY_OPTIONS: EntityType[] = [
  'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES',
  'BYTES_REST_TECH', 'PERSONAL', 'MULTI_ENTITY', 'BUSINESS_SHARED', 'UNKNOWN',
];

const STATUS_OPTIONS: AuditStatus[] = [
  'UNREVIEWED', 'TAGGED', 'CONFIRMED', 'NEEDS_RECEIPT', 'PERSONAL_NO_DEDUCT', 'DISPUTED',
];

const ACCOUNT_NAME_OPTIONS = ACCOUNTS.map((a) => `···${a.last4} — ${a.label}`);

export default function TransactionDetailDrawer({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const [confirmedEntity, setConfirmedEntity] = useState<EntityType>((tx.confirmedEntity || tx.entityTag) as EntityType);
  const [status, setStatus] = useState<AuditStatus>(tx.auditStatus);
  const [purpose, setPurpose] = useState(tx.businessPurpose || '');
  const [docRef, setDocRef] = useState(tx.receiptRef || '');
  const [individual, setIndividual] = useState(tx.individual || '');
  const [sub1, setSub1] = useState(tx.subCategory1 || '');
  const [sub2, setSub2] = useState(tx.subCategory2 || '');
  const [sourceOfMoney, setSourceOfMoney] = useState(tx.sourceOfMoney || '');
  const [needFrom, setNeedFrom] = useState(tx.needToGetFrom || '');
  const [notes, setNotes] = useState(tx.notes || '');
  const [cpaReviewed, setCpaReviewed] = useState(tx.cpaReviewed);
  const [taggedDate, setTaggedDate] = useState(tx.taggedDate || '');
  const [traceOpen, setTraceOpen] = useState(false);
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError } = useToast();
  const acct = getAccount(tx.accountId);
  const entityColor = ENTITY_COLORS[(tx.confirmedEntity || tx.entityTag) as EntityType] || '#888';

  function persist(patch: any) {
    const id = saveStart();
    startTx(async () => {
      try {
        await saveTransaction(tx.id, patch);
        saveEnd(id);
      } catch (e: any) { saveError(id, e?.message); }
    });
  }

  function applyStatus(s: AuditStatus) {
    setStatus(s);
    persist({ auditStatus: s });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') onClose();
      else if (e.key === '1') applyStatus('CONFIRMED');
      else if (e.key === '2') applyStatus('NEEDS_RECEIPT');
      else if (e.key === '3') applyStatus('PERSONAL_NO_DEDUCT');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Portal>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className="absolute top-0 right-0 bottom-0 w-[min(640px,100vw)] bg-bg-1 border-l border-line flex flex-col shadow-soft"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header (fixed at top) */}
          <div className="shrink-0 bg-bg-1 border-b border-line px-5 py-3 flex items-center justify-between">
            <div className="text-sm font-medium">Transaction details</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTraceOpen(true)}
                className="btn btn-ghost text-xs"
                title="Trace where this money came from"
              >
                <Search size={12} /> Trace source
              </button>
              <button onClick={onClose} className="text-ink-mute hover:text-ink p-1"><X size={16} /></button>
            </div>
          </div>

          {/* Body (scrollable, fills remaining space) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Summary */}
            <div className="card p-4 space-y-2" style={{ borderColor: `${entityColor}40` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-base">{tx.merchantName || tx.description.slice(0, 80)}</div>
                  <div className="text-[11px] text-ink-mute mt-1 break-words">{tx.description}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`mono tabnum text-2xl font-semibold ${tx.amount >= 0 ? 'text-income' : 'text-expense'}`}>
                    {fmtMoney(tx.amount)}
                  </div>
                  {tx.balance != null ? (
                    <div className="mono tabnum text-[11px] text-ink-mute">balance after: {fmtMoney(tx.balance)}</div>
                  ) : null}
                </div>
              </div>
              <div className="text-[11px] text-ink-dim flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-line">
                <span>📅 {fmtDate(tx.postingDate)}</span>
                <span>Paid from <span className="mono">···{tx.accountId}</span>{acct ? ` (${acct.label})` : ''}</span>
                <span>Posted as {tx.category.replace(/^(EXPENSE_|INCOME_)/, '').replace(/_/g, ' ').toLowerCase()}</span>
              </div>
            </div>

            {/* Status + CPA reviewed + Tagged date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Status">
                <select value={status} onChange={(e) => { applyStatus(e.target.value as AuditStatus); }} className="w-full">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
                  ))}
                </select>
              </Field>
              <Field label="CPA reviewed">
                <button
                  type="button"
                  onClick={() => { const v = !cpaReviewed; setCpaReviewed(v); persist({ cpaReviewed: v }); }}
                  className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-sm transition ${
                    cpaReviewed
                      ? 'bg-income/15 border-income/40 text-income'
                      : 'bg-bg-2 border-line text-ink-dim hover:text-ink'
                  }`}
                >
                  {cpaReviewed ? <><Check size={14} /> Yes — reviewed</> : 'No — not reviewed'}
                </button>
              </Field>
              <Field label="Tagged date" hint="any date you want to associate (booking period, review date, etc.)">
                <input
                  type="date"
                  value={taggedDate}
                  onChange={(e) => setTaggedDate(e.target.value)}
                  onBlur={() => persist({ taggedDate: taggedDate || null })}
                  className="w-full"
                />
              </Field>
            </div>

            {/* Audit fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Books to entity">
                <select
                  value={confirmedEntity}
                  onChange={(e) => { const v = e.target.value as EntityType; setConfirmedEntity(v); persist({ confirmedEntity: v }); }}
                  className="w-full"
                >
                  {ENTITY_OPTIONS.map((o) => (
                    <option key={o} value={o}>{ENTITY_LABELS[o]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Individual" hint="who is this about">
                <input
                  type="text"
                  value={individual}
                  onChange={(e) => setIndividual(e.target.value)}
                  onBlur={() => persist({ individual: individual || null })}
                  className="w-full"
                  placeholder="Person / vendor"
                />
              </Field>
              <Field label="Sub category 1">
                <input
                  type="text"
                  value={sub1}
                  onChange={(e) => setSub1(e.target.value)}
                  onBlur={() => persist({ subCategory1: sub1 || null })}
                  className="w-full"
                  placeholder="e.g. Grubhub revenue, Software"
                />
              </Field>
              <Field label="Sub category 2">
                <input
                  type="text"
                  value={sub2}
                  onChange={(e) => setSub2(e.target.value)}
                  onBlur={() => persist({ subCategory2: sub2 || null })}
                  className="w-full"
                  placeholder="optional further breakdown"
                />
              </Field>
              <Field label="Source of money to pay">
                <input
                  type="text"
                  list="acct-list"
                  value={sourceOfMoney}
                  onChange={(e) => setSourceOfMoney(e.target.value)}
                  onBlur={() => persist({ sourceOfMoney: sourceOfMoney || null })}
                  className="w-full"
                  placeholder="which account covers this"
                />
              </Field>
              <Field label="Need to get from">
                <input
                  type="text"
                  list="acct-list"
                  value={needFrom}
                  onChange={(e) => setNeedFrom(e.target.value)}
                  onBlur={() => persist({ needToGetFrom: needFrom || null })}
                  className="w-full"
                  placeholder="where to source funds from"
                />
              </Field>
              <Field label="Business purpose" className="md:col-span-2">
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  onBlur={() => persist({ businessPurpose: purpose || null })}
                  className="w-full"
                  placeholder="What was this transaction for?"
                />
              </Field>
              <Field label="Doc reference" className="md:col-span-2">
                <input
                  type="text"
                  value={docRef}
                  onChange={(e) => setDocRef(e.target.value)}
                  onBlur={() => persist({ receiptRef: docRef || null })}
                  className="w-full"
                  placeholder="INV-123 / link to file"
                />
              </Field>
              <Field label="Notes" className="md:col-span-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => persist({ notes: notes || null })}
                  className="w-full"
                  rows={2}
                  placeholder="anything else"
                />
              </Field>
            </div>

            <datalist id="acct-list">
              {ACCOUNT_NAME_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </datalist>

            {/* Split editor */}
            <SplitEditor transactionId={tx.id} transactionAmount={tx.amount} />

            {/* Quick status buttons + hint */}
            <div className="border-t border-line pt-3 flex flex-wrap items-center gap-2">
              <button className="btn btn-primary" onClick={() => applyStatus('CONFIRMED')}>
                <kbd>1</kbd> ✅ Confirm
              </button>
              <button className="btn" onClick={() => applyStatus('NEEDS_RECEIPT')}>
                <kbd>2</kbd> 🔴 Needs receipt
              </button>
              <button className="btn" onClick={() => applyStatus('PERSONAL_NO_DEDUCT')}>
                <kbd>3</kbd> ❌ Personal
              </button>
              <div className="text-[11px] text-ink-mute ml-auto">Esc to close · changes save automatically</div>
            </div>
          </div>
          {/* Body close */}
        </div>
      </div>
      {traceOpen ? <SourceTraceModal txId={tx.id} onClose={() => setTraceOpen(false)} /> : null}
    </Portal>
  );
}

function Field({ label, children, className = '', hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">
        {label}
        {hint ? <span className="ml-1 text-ink-mute normal-case">· {hint}</span> : null}
      </div>
      <div>{children}</div>
    </label>
  );
}
