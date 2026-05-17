'use client';

import { useEffect, useState, useTransition } from 'react';
import { X, Check } from 'lucide-react';
import type { Transaction, EntityType, AuditStatus } from '@/types';
import { ACCOUNTS, ENTITY_LABELS, ENTITY_COLORS, getAccount } from '@/constants/accounts';
import { fmtMoney, fmtDate } from '@/lib/format';
import { saveTransaction } from './actions';
import { useToast } from '@/components/Toast';
import SplitEditor from '../audit/SplitEditor';
import SourceTraceContent from './SourceTraceContent';
import SameDayPanel from './SameDayPanel';
import Portal from '@/components/Portal';
import { ArrowDownToLine } from 'lucide-react';

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
  const [sourcePersonId, setSourcePersonId] = useState(tx.sourcePersonId || '');
  const [sourceBusiness, setSourceBusiness] = useState(tx.sourceBusiness || '');
  const [sourceAccountId, setSourceAccountId] = useState(tx.sourceAccountId || '');
  const [budgetId, setBudgetId] = useState(tx.budgetId || '');
  const [budgets, setBudgets] = useState<{ id: string; name: string; kind: string; entity: string | null }[] | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string; role: string }[] | null>(null);
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
    let cancelled = false;
    fetch('/api/people', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setPeople(d.people || []); })
      .catch(() => { if (!cancelled) setPeople([]); });
    fetch('/api/budgets', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setBudgets(d.budgets || []); })
      .catch(() => { if (!cancelled) setBudgets([]); });
    return () => { cancelled = true; };
  }, []);

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
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.stopPropagation()}
        >
          {/* Header (fixed at top) */}
          <div className="shrink-0 bg-bg-1 border-b border-line px-5 py-3 flex items-center justify-between">
            <div className="text-sm font-medium">Transaction details</div>
            <button onClick={onClose} className="text-ink-mute hover:text-ink p-1"><X size={16} /></button>
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
                {tx.transactionDate && tx.transactionDate !== tx.postingDate ? (
                  <span title="Extracted from description — when the charge/transfer actually happened.">
                    💳 Transaction: <span className="mono">{fmtDate(tx.transactionDate)}</span>
                  </span>
                ) : null}
                <span title="From Chase — when the bank processed this transaction. Cannot be changed.">
                  🏦 Posted on bank: <span className="mono">{fmtDate(tx.postingDate)}</span>
                </span>
                <span>Paid from <span className="mono">···{tx.accountId}</span>{acct ? ` (${acct.label})` : ''}</span>
                <span>Posted as {tx.category.replace(/^(EXPENSE_|INCOME_)/, '').replace(/_/g, ' ').toLowerCase()}</span>
              </div>
            </div>

            {/* Source of money — loaded inline at the very top so it's always visible */}
            {tx.amount < 0 ? (
              <section>
                <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2 inline-flex items-center gap-1.5">
                  <ArrowDownToLine size={12} className="text-income" />
                  Source of money for this expense
                </div>
                <SourceTraceContent txId={tx.id} compact />
              </section>
            ) : null}

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
              <Field label="Booking date" hint="the only editable date — when this should be booked for accounting; defaults blank if unset">
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
              <Field
                label={tx.amount > 0 ? 'Source person (income)' : 'Source / counterparty person'}
                hint={tx.amount > 0 ? 'who this money came FROM — investor, partner, etc.' : 'who this money went TO, if applicable'}
              >
                <select
                  value={sourcePersonId}
                  onChange={(e) => {
                    setSourcePersonId(e.target.value);
                    persist({ sourcePersonId: e.target.value || null });
                  }}
                  className="w-full"
                >
                  <option value="">— None —</option>
                  {(people || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role.toLowerCase()})
                    </option>
                  ))}
                </select>
                {(people && people.length === 0) ? (
                  <div className="text-[10px] text-ink-mute mt-1">No people yet — add them on the <a href="/team" className="text-entity-bytes hover:underline">Team page</a>.</div>
                ) : null}
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
              {tx.amount > 0 ? (
                <>
                  <Field label="Source business · who sent this">
                    <select
                      value={sourceBusiness}
                      onChange={(e) => { setSourceBusiness(e.target.value); persist({ sourceBusiness: e.target.value || null }); }}
                      className="w-full"
                    >
                      <option value="">— pick —</option>
                      <option value="BYTES_AI">Bytes AI</option>
                      <option value="ROCKET_WIRELESS">Rocket Wireless</option>
                      <option value="DELICIOUS_BYTES">Delicious Bytes LLC</option>
                      <option value="AMARI_VENTURES">Amari Ventures</option>
                      <option value="BYTES_REST_TECH">Bytes Restaurant Tech</option>
                      <option value="PERSONAL">Personal</option>
                      <option value="EXTERNAL">External / N/A (outside business)</option>
                    </select>
                  </Field>
                  <Field label="Source account · which bank sent it">
                    <select
                      value={sourceAccountId}
                      onChange={(e) => { setSourceAccountId(e.target.value); persist({ sourceAccountId: e.target.value || null }); }}
                      className="w-full"
                    >
                      <option value="">— pick —</option>
                      {ACCOUNTS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {ENTITY_LABELS[a.entity]} — ···{a.last4}
                        </option>
                      ))}
                      <option value="EXTERNAL">External / N/A (outside account)</option>
                    </select>
                  </Field>
                </>
              ) : (
                <>
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
                </>
              )}
              <Field
                label={tx.amount < 0 ? 'Under an existing budget?' : 'Counts toward an income target?'}
                className="md:col-span-2"
                hint={budgets && budgets.length === 0 ? 'no budgets yet — create one at /budgets' : undefined}
              >
                <select
                  value={budgetId}
                  onChange={(e) => { setBudgetId(e.target.value); persist({ budgetId: e.target.value || null }); }}
                  className="w-full"
                  disabled={budgets === null}
                >
                  <option value="">No — not in any budget</option>
                  {budgets?.filter((b) => (tx.amount < 0 ? b.kind === 'EXPENSE' : b.kind === 'INCOME')).map((b) => (
                    <option key={b.id} value={b.id}>
                      Yes — {b.name}{b.entity ? ` (${b.entity.replace(/_/g, ' ').toLowerCase()})` : ''}
                    </option>
                  ))}
                </select>
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

            {/* Same-day bulk apply */}
            <SameDayPanel
              txId={tx.id}
              postingDate={tx.postingDate}
              accountId={tx.accountId}
              currentTags={{
                confirmedEntity,
                subCategory1: sub1 || null,
                subCategory2: sub2 || null,
                individual: individual || null,
                sourceOfMoney: sourceOfMoney || null,
                needToGetFrom: needFrom || null,
                businessPurpose: purpose || null,
                taggedDate: taggedDate || null,
                cpaReviewed,
              }}
            />

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
