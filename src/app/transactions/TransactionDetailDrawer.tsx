'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  X, ChevronDown, Check, Lock, Plus, ArrowDown, ArrowRight,
  User, Building2, Repeat, Calendar, Wallet, Receipt, Paperclip,
  Split, Tag, Award, Link2, Sparkles, ShieldCheck, AlertTriangle, Flag,
} from 'lucide-react';
import type { Transaction, EntityType, AuditStatus } from '@/types';
import { ACCOUNTS, ENTITY_LABELS, ENTITY_COLORS, BUSINESS_ENTITIES, getAccount } from '@/constants/accounts';
import {
  PERSONAL_CATEGORIES, BUSINESS_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES, BUSINESS_INCOME_CATEGORIES,
} from '@/constants/categories';
import { fmtMoney, fmtDate } from '@/lib/format';
import { saveTransaction, recurringAllocationPreviewAction } from './actions';
import { listSplitsAction } from './splitActions';
import { useToast } from '@/components/Toast';
import Portal from '@/components/Portal';
import ManualSourceLink, { type ManualSourceLinkHandle } from './ManualSourceLink';
import ManualDownstreamList from './ManualDownstreamList';
import DrawerSplitEditor from './DrawerSplitEditor';
import SameDayPanel from './SameDayPanel';
import PersonPicker from '@/components/PersonPicker';

type SectionKey = 'source' | 'booked' | 'recurrence' | 'flow' | 'passthrough' | 'split' | 'notes' | 'review' | 'cpa';

const STATUS_PILL: Record<AuditStatus, { label: string; cls: string }> = {
  UNREVIEWED: { label: 'Unreviewed', cls: 'pill-unreviewed' },
  TAGGED: { label: 'Tagged', cls: 'pill-tagged' },
  CONFIRMED: { label: 'Confirmed', cls: 'pill-confirmed' },
  NEEDS_RECEIPT: { label: 'Needs receipt', cls: 'pill-needs-receipt' },
  PERSONAL_NO_DEDUCT: { label: 'Personal', cls: 'pill-personal' },
  DISPUTED: { label: 'Disputed', cls: 'pill-disputed' },
};

export default function TransactionDetailDrawer({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [, startTx] = useTransition();
  const acct = getAccount(tx.accountId);

  // Editable state seeded from tx
  const [state, setStateRaw] = useState({
    auditStatus: tx.auditStatus as AuditStatus,
    bookingDateMode: (tx.bookingDateMode || 'MONTH') as 'DAY' | 'MONTH',
    taggedDate: tx.taggedDate || '',
    personalOrBusiness: (tx.confirmedEntity === 'PERSONAL' ? 'PERSONAL' : tx.confirmedEntity ? 'BUSINESS' : null) as 'PERSONAL' | 'BUSINESS' | null,
    confirmedEntity: (tx.confirmedEntity || tx.entityTag) as EntityType,
    businessDepartment: tx.businessDepartment || '',
    businessCat1Key: tx.businessCat1Key || '',
    businessSubCat2: tx.subCategory2 || '',
    taxTreatment: tx.taxTreatment || '',
    taxForm: tx.taxForm || '',
    individual: tx.individual || '',
    personalCat1Key: tx.personalCat1Key || '',
    personalSubCat: tx.subCategory2 || '',
    counterpartyPersonId: tx.sourcePersonId || '',
    isRecurring: tx.isRecurring || false,
    recurringFrequency: tx.recurringFrequency || 'MONTHLY',
    recurringNextDate: tx.recurringNextDate || '',
    recurringLabel: tx.recurringLabel || '',
    recurringAlertDays: tx.recurringAlertDays || 3,
    recurringAlertDays2: tx.recurringAlertDays2 ?? 0, // 0 = no second alert
    recurringExpectedAmount: tx.recurringExpectedCents != null
      ? (tx.recurringExpectedCents / 100).toFixed(2)
      : Math.abs(tx.amount).toFixed(2),
    reviewState: tx.reviewState || '',
    reviewerName: tx.reviewerName || '',
    reviewedAt: tx.reviewedAt || '',
    needsEscalation: !!tx.needsEscalation,
    escalationTo: tx.escalationTo || '',
    escalationNotes: tx.escalationNotes || '',
    fundingCommitmentId: tx.fundingCommitmentId || '',
    moneySource: tx.sourceOfMoney || '',
    sourceEntityForPay: '',     // derived initially, may be set by picker
    sourceAccountForPay: tx.sourceAccountId || '',
    needToGetFrom: tx.needToGetFrom || '',
    hop2Person: tx.salaryPersonId || '',
    hop3Entity: tx.passthroughEntity || '',
    passedOnward: !!tx.passthroughEntity,
    passthroughEntity: tx.passthroughEntity || '',
    passthroughPurpose: tx.passthroughPurpose || '',
    passthroughNotes: tx.passthroughNotes || '',
    businessPurpose: tx.businessPurpose || '',
    docRef: tx.receiptRef || '',
    notes: tx.notes || '',
    autoDetect: tx.autoDetectRule || false,
    cpaReviewed: tx.cpaReviewed || false,
    cpaReviewerName: tx.cpaReviewerName || '',
    cpaReviewedAt: tx.cpaReviewedAt || '',
  });

  const [openMap, setOpenMap] = useState<Record<SectionKey, boolean>>({
    source: true,
    booked: true,
    recurrence: false,
    flow: false,
    passthrough: !!tx.passthroughEntity,
    split: true,
    notes: false,
    review: false,
    cpa: false,
  });
  const toggle = (k: SectionKey) => setOpenMap((m) => ({ ...m, [k]: !m[k] }));

  // Split-first flow: track whether this transaction is split (decision-first UX).
  // Initialize from server — if any splits exist, mark as split.
  const [isSplit, setIsSplit] = useState<boolean | null>(null);
  useEffect(() => {
    listSplitsAction(tx.id)
      .then((rows) => setIsSplit((rows?.length ?? 0) > 0))
      .catch(() => setIsSplit(false));
  }, [tx.id]);

  // AI source detection — pulses for ~1.4s minimum, then refreshes ManualSourceLink.
  const sourceLinkRef = useRef<ManualSourceLinkHandle | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  async function runAITrace() {
    if (aiThinking) return;
    setAiThinking(true);
    setAiError(null);
    const startedAt = Date.now();
    try {
      const r = await fetch('/api/flow/ai-trace', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ txId: tx.id }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || `http_${r.status}`);
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1400) await new Promise((res) => setTimeout(res, 1400 - elapsed));
      await sourceLinkRef.current?.reload();
    } catch (e: any) {
      setAiError(e?.message === 'no_source_found' ? 'No prior inflow found on this account.' : 'AI trace failed. Try again.');
    } finally {
      setAiThinking(false);
    }
  }

  // Persist helper — calls saveTransaction with the proper patch keys
  function persist(patch: any) {
    const id = saveStart();
    startTx(async () => {
      try {
        await saveTransaction(tx.id, patch);
        saveEnd(id);
      } catch (e: any) {
        saveError(id, e?.message);
      }
    });
  }

  function setState(patch: Partial<typeof state>, dbPatch?: any) {
    setStateRaw((s) => ({ ...s, ...patch }));
    if (dbPatch) persist(dbPatch);
  }

  // Keyboard handler — Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress dots — 5 required completion criteria
  const completed = (
    (tx.postingDate ? 1 : 0) +
    (state.personalOrBusiness ? 1 : 0) +
    (state.confirmedEntity || state.personalOrBusiness === 'PERSONAL' ? 1 : 0) +
    (state.businessSubCat2 || state.personalSubCat ? 1 : 0) +
    (state.auditStatus !== 'UNREVIEWED' ? 1 : 0)
  );

  const isExpense = tx.amount < 0;
  const stPill = STATUS_PILL[state.auditStatus] || STATUS_PILL.UNREVIEWED;

  return (
    <Portal>
      <div className="backdrop animate-fade-in" onClick={onClose} />
      <div
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="dr-head">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="t-lg" style={{ margin: 0, letterSpacing: '-0.015em', color: 'var(--ink)' }}>
                {tx.merchantName || tx.description.slice(0, 60)}
              </h2>
              <p className="num text-[11px] text-ink-mute mt-1 truncate" style={{ maxWidth: 340 }}>
                {tx.description}
              </p>
            </div>
            <div
              className="t-display whitespace-nowrap"
              style={{ color: isExpense ? 'var(--expense)' : 'var(--income)' }}
            >
              {fmtMoney(tx.amount)}
            </div>
          </div>

          <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
            <span className={`pill ${stPill.cls}`}>
              <span className="w-[5px] h-[5px] rounded-full" style={{ background: 'currentColor' }} /> {stPill.label}
            </span>
            <span className="text-[11px] text-ink-mute">
              ····{tx.accountId}{acct ? ` · ${acct.label}` : ''}
            </span>
            {tx.balance != null ? (
              <>
                <span className="text-[11px] text-ink-ghost">·</span>
                <span className="text-[10.5px] text-ink-mute">
                  balance after <span className="num">{fmtMoney(tx.balance)}</span>
                </span>
              </>
            ) : null}
            <span className="flex-1" />
            {/* Progress dots */}
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className="rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: i < completed ? 'var(--gold)' : 'var(--bg-4)',
                    transition: 'background 120ms ease',
                  }}
                />
              ))}
              <span className="text-[10.5px] text-ink-mute ml-1">{completed}/5</span>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 4 }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="dr-body">
          {/* ① Dates */}
          <DatesSection tx={tx} state={state} setState={setState} />

          {/* ② Source of money — funding splits */}
          <SectionCard
            accent="green"
            open={openMap.source}
            setOpen={() => toggle('source')}
            icon={<Lock size={13} style={{ color: 'var(--ink-3)' }} />}
            title="Source of money"
            badge="truth"
            badgeColor="pill-truth"
            summary={summaryForSource(tx)}
          >
            <div className="text-[11.5px] text-ink-mute mb-3.5">
              Tag this expense to one or more income sources, each with its own dollar amount.
            </div>

            {/* AI Find Source strip — only for expenses */}
            {isExpense ? (
              <div
                className="flex items-center gap-2.5 mb-3.5"
                style={{
                  padding: '10px 12px',
                  background:
                    'linear-gradient(90deg, color-mix(in oklab, var(--gold) 12%, var(--bg-3)), var(--bg-3))',
                  border: '0.5px solid rgba(201,168,122,0.30)',
                  borderRadius: 8,
                }}
              >
                <div
                  className="grid place-items-center shrink-0"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: 'rgba(201,168,122,0.18)',
                    color: 'var(--gold)',
                  }}
                >
                  <Sparkles size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
                    {aiThinking ? 'Tracing through your accounts…' : 'Auto-trace this expense'}
                  </div>
                  <div className="text-[10.5px] text-ink-mute mt-px">
                    {aiThinking
                      ? 'Following FIFO from prior inflows · scanning this account'
                      : aiError || 'FoundersOS AI will find which prior inflow funded this. You can override.'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={runAITrace}
                  disabled={aiThinking}
                  style={{
                    background: 'rgba(201,168,122,0.16)',
                    borderColor: 'rgba(201,168,122,0.4)',
                    color: 'var(--gold)',
                    opacity: aiThinking ? 0.6 : 1,
                  }}
                >
                  {aiThinking ? (
                    <>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 50,
                          background: 'var(--gold)',
                          animation: 'pulse 0.9s ease infinite',
                          display: 'inline-block',
                        }}
                      />
                      Thinking
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} /> Find source with AI
                    </>
                  )}
                </button>
              </div>
            ) : null}

            {isExpense ? (
              <ManualSourceLink ref={sourceLinkRef} txId={tx.id} expenseAmount={tx.amount} />
            ) : (
              <ManualDownstreamList inflowTxId={tx.id} inflowAmount={tx.amount} />
            )}
          </SectionCard>

          {/* ⑦→② Split decision — comes BEFORE Booked Attribution (v2.1) */}
          <SectionCard
            accent={isSplit ? 'purple' : undefined}
            open={openMap.split}
            setOpen={() => toggle('split')}
            icon={<Split size={13} style={{ color: 'var(--ink-3)' }} />}
            title="Split transaction"
            badge={isSplit ? 'split first' : undefined}
            badgeColor={isSplit ? 'pill-personal' : undefined}
            summary={
              isSplit === null
                ? 'Checking…'
                : isSplit
                  ? 'Multiple parts · each gets its own categorization'
                  : 'Single transaction · not split'
            }
          >
            <div className="text-[11.5px] text-ink-mute mb-3.5">
              Does this charge cover more than one entity, category, or period?
              Decide here first — then categorize each part separately below.
            </div>

            {/* Yes/No decision */}
            <div className="grid grid-cols-2 gap-2 mb-3.5">
              <button
                type="button"
                onClick={() => setIsSplit(false)}
                className="btn"
                style={{
                  padding: '11px 14px',
                  justifyContent: 'flex-start',
                  background: isSplit === false
                    ? 'color-mix(in oklab, var(--ink-3) 14%, var(--bg-3))'
                    : 'var(--bg-3)',
                  borderColor: isSplit === false ? 'var(--ink-3)' : 'var(--border-default, rgba(255,255,255,0.12))',
                  color: isSplit === false ? 'var(--ink)' : 'var(--ink-2)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <Check size={12} style={{ opacity: isSplit === false ? 1 : 0 }} />
                No — one charge, one categorization
              </button>
              <button
                type="button"
                onClick={() => setIsSplit(true)}
                className="btn"
                style={{
                  padding: '11px 14px',
                  justifyContent: 'flex-start',
                  background: isSplit
                    ? 'color-mix(in oklab, var(--purple) 14%, var(--bg-3))'
                    : 'var(--bg-3)',
                  borderColor: isSplit ? 'var(--purple)' : 'var(--border-default, rgba(255,255,255,0.12))',
                  color: isSplit ? 'var(--purple)' : 'var(--ink-2)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <Split size={12} /> Yes — split this charge
              </button>
            </div>

            {isSplit ? (
              <DrawerSplitEditor transactionId={tx.id} transactionAmount={tx.amount} />
            ) : null}
          </SectionCard>

          {/* ③ Booked attribution — only when NOT split */}
          {isSplit === false ? (
            <BookedAttributionSection
              state={state}
              setState={setState}
              open={openMap.booked}
              setOpen={() => toggle('booked')}
              isIncome={tx.amount > 0}
            />
          ) : null}

          {/* ④ Recurrence — hidden at the transaction level when split, since
              each part below now carries its own recurrence settings. */}
          {!isSplit ? (
            <RecurrenceSection
              tx={tx}
              state={state}
              setState={setState}
              open={openMap.recurrence}
              setOpen={() => toggle('recurrence')}
            />
          ) : null}

          {/* ⑤ Money flow & ⑥ Passed onward — hidden at the transaction level
              when split. Each split row carries its own funding entity,
              reimbursement, money chain, and passthrough below. */}
          {!isSplit ? (
            <>
              <MoneyFlowSection
                tx={tx}
                state={state}
                setState={setState}
                open={openMap.flow}
                setOpen={() => toggle('flow')}
                isIncome={tx.amount > 0}
              />
              <PassedOnwardSection
                tx={tx}
                state={state}
                setState={setState}
                open={openMap.passthrough}
                setOpen={() => toggle('passthrough')}
              />
            </>
          ) : null}

          {/* ⑧ Notes — when split, each part carries its own notes so the
              top-level section collapses to just a free-text note. */}
          <NotesSection
            tx={tx}
            state={state}
            setState={setState}
            open={openMap.notes}
            setOpen={() => toggle('notes')}
            notesOnly={!!isSplit}
          />

          {/* Review checklist */}
          <ReviewChecklist state={state} tx={tx} />

          {/* Same-day apply */}
          <SameDayPanel
            txId={tx.id}
            postingDate={tx.postingDate}
            accountId={tx.accountId}
            currentTags={{
              confirmedEntity: state.confirmedEntity,
              subCategory1: state.businessCat1Key || state.personalCat1Key || null,
              subCategory2: state.businessSubCat2 || state.personalSubCat || null,
              individual: state.individual || null,
              sourceOfMoney: state.moneySource || null,
              needToGetFrom: state.needToGetFrom || null,
              businessPurpose: state.businessPurpose || null,
              taggedDate: state.taggedDate || null,
              cpaReviewed: state.cpaReviewed,
            }}
          />

          {/* Review & escalation */}
          <ReviewSection
            state={state}
            setState={setState}
            open={openMap.review}
            setOpen={() => toggle('review')}
          />

          {/* CPA */}
          <CPASection
            state={state}
            setState={setState}
            open={openMap.cpa}
            setOpen={() => toggle('cpa')}
          />

          <div className="h-4" />
        </div>

      </div>
    </Portal>
  );
}

// ──────────────────── SectionCard helper ────────────────────
function SectionCard({
  accent, open, setOpen, title, badge, badgeColor, icon, summary, children,
}: {
  accent?: 'gold' | 'green' | 'warn' | 'purple' | 'blue';
  open: boolean;
  setOpen: () => void;
  title: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`card ${accent || ''}`}>
      <div className="card-head" onClick={setOpen}>
        {icon && <span style={{ display: 'inline-flex' }}>{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="t-md" style={{ color: 'var(--ink)' }}>{title}</span>
            {badge && <span className={`pill ${badgeColor || ''}`} style={{ fontSize: 10 }}>{badge}</span>}
          </div>
          {!open && summary && (
            <div className="text-[11.5px] text-ink-mute mt-0.5">{summary}</div>
          )}
        </div>
        <ChevronDown
          size={14}
          className="text-ink-mute"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }}
        />
      </div>
      <div className={`collapse-section ${open ? 'open' : ''}`}>
        <div>
          <div className="card-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, hint, labelGold, children, span,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  labelGold?: boolean;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : 'auto' }}>
      <div className={`field-label ${labelGold ? 'gold' : ''}`}>{label}</div>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}

function summaryForSource(tx: Transaction): string {
  if (tx.amount > 0) return 'Inflow · expenses link in from this wire';
  return 'Tag this expense to its income source';
}

// ──────────────────── Section ① — Dates ────────────────────
function DatesSection({ tx, state, setState }: { tx: Transaction; state: any; setState: any }) {
  const mode = state.bookingDateMode || 'MONTH';
  const bookedDate = state.taggedDate || tx.taggedDate || '';
  const displayBooked = bookedDate
    ? mode === 'MONTH'
      ? new Date(bookedDate + (bookedDate.length === 7 ? '-01' : '')).toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : new Date(bookedDate).toLocaleDateString()
    : '—';
  const chargeDate = tx.transactionDate;

  return (
    <div className="px-1 pb-1.5">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Charge date" hint="From transaction description">
          <div
            className="num"
            style={{
              padding: '8px 10px',
              borderRadius: 7,
              background: 'var(--bg-3)',
              border: '0.5px solid var(--border-subtle)',
              color: 'var(--ink-2)',
              fontSize: 13,
            }}
          >
            {chargeDate ? fmtDate(chargeDate) : '—'}
          </div>
        </Field>
        <Field label="Posted date" hint="From bank · read-only">
          <div
            className="num"
            style={{
              padding: '8px 10px',
              borderRadius: 7,
              background: 'var(--bg-3)',
              border: '0.5px solid var(--border-subtle)',
              color: 'var(--ink-2)',
              fontSize: 13,
            }}
          >
            {fmtDate(tx.postingDate)}
          </div>
        </Field>
        <Field
          labelGold
          label={<span>Booked date <span style={{ color: 'var(--gold)' }}>✏</span></span>}
          hint={mode === 'MONTH' ? 'Books to the 1st · useful for subscriptions' : 'Books to the specific day'}
        >
          {mode === 'MONTH' ? (
            <input
              type="month"
              value={bookedDate.slice(0, 7)}
              onChange={(e) => {
                const v = e.target.value ? `${e.target.value}-01` : '';
                setState({ taggedDate: v }, { taggedDate: v || null });
              }}
              className="num"
              style={{
                background: 'var(--bg-3)',
                border: '0.5px solid rgba(201,168,122,0.5)',
                boxShadow: '0 0 0 2px rgba(201,168,122,0.12)',
                fontWeight: 500,
              }}
            />
          ) : (
            <input
              type="date"
              value={bookedDate}
              onChange={(e) => setState({ taggedDate: e.target.value }, { taggedDate: e.target.value || null })}
              className="num"
              style={{
                background: 'var(--bg-3)',
                border: '0.5px solid rgba(201,168,122,0.5)',
                boxShadow: '0 0 0 2px rgba(201,168,122,0.12)',
                fontWeight: 500,
              }}
            />
          )}
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => setState({ bookingDateMode: 'DAY' }, { bookingDateMode: 'DAY' })}
              className="btn btn-sm"
              style={{
                flex: 1,
                justifyContent: 'center',
                background: mode === 'DAY' ? 'rgba(201,168,122,0.16)' : 'var(--bg-3)',
                borderColor: mode === 'DAY' ? 'rgba(201,168,122,0.4)' : 'var(--border-subtle)',
                color: mode === 'DAY' ? 'var(--gold)' : 'var(--ink-3)',
              }}
            >
              Specific day {mode === 'DAY' && <Check size={10} className="ml-1" />}
            </button>
            <button
              type="button"
              onClick={() => setState({ bookingDateMode: 'MONTH' }, { bookingDateMode: 'MONTH' })}
              className="btn btn-sm"
              style={{
                flex: 1,
                justifyContent: 'center',
                background: mode === 'MONTH' ? 'rgba(201,168,122,0.16)' : 'var(--bg-3)',
                borderColor: mode === 'MONTH' ? 'rgba(201,168,122,0.4)' : 'var(--border-subtle)',
                color: mode === 'MONTH' ? 'var(--gold)' : 'var(--ink-3)',
              }}
            >
              Month only {mode === 'MONTH' && <Check size={10} className="ml-1" />}
            </button>
          </div>
        </Field>
      </div>
    </div>
  );
}

// ──────────────────── ③ Booked Attribution ────────────────────
function BookedAttributionSection({
  state, setState, open, setOpen, isIncome = false,
}: { state: any; setState: any; open: boolean; setOpen: () => void; isIncome?: boolean }) {
  const isB = state.personalOrBusiness === 'BUSINESS';
  const isP = state.personalOrBusiness === 'PERSONAL';

  const summary = isB
    ? `Business · ${state.confirmedEntity ? ENTITY_LABELS[state.confirmedEntity as EntityType] : '—'} · ${state.businessSubCat2 || 'no sub'}`
    : isP
      ? `Personal · ${state.personalCat1Key ? (PERSONAL_CATEGORIES[state.personalCat1Key]?.label || state.personalCat1Key) : 'no cat'} · ${state.personalSubCat || 'no sub'}`
      : 'Pick a path';

  return (
    <SectionCard
      accent={isP ? 'purple' : 'gold'}
      open={open}
      setOpen={setOpen}
      title="Booked attribution"
      badge="you decide"
      badgeColor="pill-gold"
      summary={summary}
    >
      {/* Path toggle */}
      <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 18 }}>
        <PathButton
          active={isP}
          color="var(--purple)"
          icon={<User size={16} />}
          label="Personal"
          onClick={() => setState({ personalOrBusiness: 'PERSONAL', confirmedEntity: 'PERSONAL' }, { confirmedEntity: 'PERSONAL' })}
        />
        <PathButton
          active={isB}
          color="var(--gold)"
          icon={<Building2 size={16} />}
          label="Business"
          onClick={() => {
            const v = state.confirmedEntity === 'PERSONAL' ? 'BYTES_AI' : state.confirmedEntity;
            setState({ personalOrBusiness: 'BUSINESS', confirmedEntity: v }, { confirmedEntity: v });
          }}
        />
      </div>

      {isB && <BusinessPath state={state} setState={setState} isIncome={isIncome} />}
      {isP && <PersonalPath state={state} setState={setState} isIncome={isIncome} />}
      {!state.personalOrBusiness && (
        <div className="text-[12px] text-ink-mute text-center py-6">
          Pick a path to start tagging.
        </div>
      )}

      {/* Auto-detect */}
      {state.personalOrBusiness && (
        <div
          className="flex items-center gap-2.5"
          style={{
            marginTop: 18,
            padding: '10px 12px',
            background: 'var(--bg-3)',
            border: '0.5px solid var(--border-subtle)',
            borderRadius: 8,
          }}
        >
          <Repeat size={13} style={{ color: 'var(--gold)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium">Auto-detect next time</div>
            <div className="text-[10.5px] text-ink-mute">Same merchant → auto-apply this categorization</div>
          </div>
          <Toggle value={state.autoDetect} onChange={(v) => setState({ autoDetect: v }, { autoDetectRule: v })} />
        </div>
      )}
    </SectionCard>
  );
}

function PathButton({
  active, color, icon, label, onClick,
}: { active: boolean; color: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 14px',
        borderRadius: 8,
        background: active ? `color-mix(in oklab, ${color} 14%, var(--bg-3))` : 'var(--bg-3)',
        border: '0.5px solid ' + (active ? color : 'var(--border-default)'),
        color: active ? color : 'var(--ink-2)',
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        justifyContent: 'flex-start',
        transition: 'all 120ms ease',
      }}
    >
      {icon}
      <span>{label}</span>
      {active && <Check size={12} style={{ marginLeft: 'auto' }} />}
    </button>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 32,
        height: 18,
        borderRadius: 999,
        background: value ? 'var(--gold)' : 'var(--bg-4)',
        transition: 'background 150ms ease',
        position: 'relative',
        flex: '0 0 32px',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: value ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: 50,
          background: value ? 'var(--bg-0)' : 'var(--ink-3)',
          transition: 'left 150ms ease',
        }}
      />
    </button>
  );
}

function BusinessPath({ state, setState, isIncome = false }: { state: any; setState: any; isIncome?: boolean }) {
  const CAT_MAP = isIncome ? BUSINESS_INCOME_CATEGORIES : BUSINESS_CATEGORIES;
  const cat = state.businessCat1Key ? CAT_MAP[state.businessCat1Key] : null;

  return (
    <div className="flex flex-col" style={{ gap: 14 }}>
      <div className="grid grid-cols-2" style={{ gap: 14 }}>
        <Field label="Business entity">
          <EntityPicker
            value={state.confirmedEntity}
            onChange={(v) => setState({ confirmedEntity: v }, { confirmedEntity: v })}
          />
        </Field>
        <Field label="Department · optional">
          <select
            value={state.businessDepartment || ''}
            onChange={(e) => setState({ businessDepartment: e.target.value }, { businessDepartment: e.target.value || null })}
          >
            <option value="">— optional —</option>
            {['Engineering', 'Product', 'Sales & Marketing', 'Operations', 'G&A', 'Customer Success'].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2" style={{ gap: 14 }}>
        <Field label="Category">
          <select
            value={state.businessCat1Key || ''}
            onChange={(e) => setState(
              { businessCat1Key: e.target.value, businessSubCat2: '' },
              { businessCat1Key: e.target.value || null, subCategory2: null }
            )}
          >
            <option value="">— select —</option>
            {Object.entries(CAT_MAP).map(([k, c]) => (
              <option key={k} value={k}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Sub-category" hint={cat?.tax}>
          <select
            value={state.businessSubCat2 || ''}
            onChange={(e) => setState({ businessSubCat2: e.target.value }, { subCategory2: e.target.value || null })}
            disabled={!cat}
          >
            <option value="">— pick category first —</option>
            {cat?.subs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      {/* Chip grid for sub-cats */}
      {cat && (
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>Quick pick · {cat.label}</div>
          <div className="grid grid-cols-3" style={{ gap: 6 }}>
            {cat.subs.map((s) => (
              <ChipButton
                key={s}
                active={state.businessSubCat2 === s}
                color="var(--gold)"
                onClick={() => setState({ businessSubCat2: s }, { subCategory2: s })}
              >
                {s}
              </ChipButton>
            ))}
          </div>
        </div>
      )}

      <Field
        label="Individual · who is this about / counterparty"
        hint="Pick from your team or add a new person — you can email-invite them later"
      >
        <PersonPicker
          value={state.individual || ''}
          onChange={(name) => setState({ individual: name }, { individual: name || null })}
          placeholder="Pick or add a person"
        />
      </Field>

      {/* Capital Investment — tie this wire to an existing investor commitment */}
      {isIncome && state.businessCat1Key === 'CAPITAL' ? (
        <CommitmentPicker
          value={state.fundingCommitmentId || ''}
          entity={state.confirmedEntity}
          personName={state.individual || ''}
          onChange={(commitmentId) =>
            setState({ fundingCommitmentId: commitmentId }, { fundingCommitmentId: commitmentId || null })
          }
        />
      ) : null}
    </div>
  );
}

function PersonalPath({ state, setState, isIncome = false }: { state: any; setState: any; isIncome?: boolean }) {
  const CAT_MAP = isIncome ? PERSONAL_INCOME_CATEGORIES : PERSONAL_CATEGORIES;
  const cat = state.personalCat1Key ? CAT_MAP[state.personalCat1Key] : null;
  return (
    <div className="flex flex-col" style={{ gap: 14 }}>
      <Field label="Whose personal expense / paid to" hint="Pick from your team or add a new person">
        <PersonPicker
          value={state.individual || ''}
          onChange={(name) => setState({ individual: name }, { individual: name || null })}
          placeholder="Pick or add a person"
        />
      </Field>

      <div className="grid grid-cols-2" style={{ gap: 14 }}>
        <Field label="Category">
          <select
            value={state.personalCat1Key || ''}
            onChange={(e) => setState(
              { personalCat1Key: e.target.value, personalSubCat: '' },
              { personalCat1Key: e.target.value || null, subCategory2: null }
            )}
          >
            <option value="">— select —</option>
            {Object.entries(CAT_MAP).map(([k, c]) => (
              <option key={k} value={k}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Sub-category">
          <select
            value={state.personalSubCat || ''}
            onChange={(e) => setState({ personalSubCat: e.target.value }, { subCategory2: e.target.value || null })}
            disabled={!cat}
          >
            <option value="">— pick category first —</option>
            {cat?.subs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      {cat && (
        <div>
          <div className="field-label" style={{ marginBottom: 8 }}>Quick pick · {cat.label}</div>
          <div className="grid grid-cols-3" style={{ gap: 6 }}>
            {cat.subs.map((s) => (
              <ChipButton
                key={s}
                active={state.personalSubCat === s}
                color="var(--purple)"
                onClick={() => setState({ personalSubCat: s }, { subCategory2: s })}
              >
                {s}
              </ChipButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChipButton({
  active, color, onClick, children,
}: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 10px',
        minHeight: 34,
        borderRadius: 6,
        background: active ? `color-mix(in oklab, ${color} 14%, var(--bg-3))` : 'var(--bg-3)',
        border: '0.5px solid ' + (active ? color : 'var(--border-subtle)'),
        color: active ? color : 'var(--ink-2)',
        fontSize: 11.5,
        fontWeight: 500,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 100ms ease',
        lineHeight: 1.25,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {children}
    </button>
  );
}

function EntityPicker({
  value, onChange,
}: { value: EntityType; onChange: (v: EntityType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {BUSINESS_ENTITIES.map((k) => {
        const color = ENTITY_COLORS[k];
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 10px',
              borderRadius: 6,
              background: active ? `color-mix(in oklab, ${color} 14%, var(--bg-3))` : 'var(--bg-3)',
              border: '0.5px solid ' + (active ? color : 'var(--border-default)'),
              color: active ? 'var(--ink)' : 'var(--ink-2)',
              fontSize: 12,
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: color }} />
            {ENTITY_LABELS[k]}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────── ④ Recurrence ────────────────────
function RecurrenceSection({
  tx, state, setState, open, setOpen,
}: { tx: Transaction; state: any; setState: any; open: boolean; setOpen: () => void }) {
  const isRec = state.isRecurring;
  const summary = isRec
    ? `Recurring · ${(state.recurringFrequency || '').toLowerCase()} · next ${state.recurringNextDate || '—'}`
    : 'One-time charge';

  return (
    <SectionCard
      accent={isRec ? 'warn' : undefined}
      open={open}
      setOpen={setOpen}
      title="Recurrence & forecast"
      summary={summary}
    >
      <Field label="Charge type">
        <div className="grid grid-cols-2 gap-2">
          <PathButton
            active={!isRec}
            color="var(--ink-3)"
            icon={null}
            label="One-time charge"
            onClick={() => setState({ isRecurring: false }, { isRecurring: false })}
          />
          <PathButton
            active={isRec}
            color="var(--warn)"
            icon={<Repeat size={13} />}
            label="Recurring charge"
            onClick={() => setState({ isRecurring: true }, { isRecurring: true })}
          />
        </div>
      </Field>

      {isRec && (
        <>
          <div className="mt-3.5">
            <Field label="Frequency">
              <div
                className="flex gap-1 p-0.5"
                style={{
                  background: 'var(--bg-3)',
                  border: '0.5px solid var(--border-subtle)',
                  borderRadius: 7,
                }}
              >
                {['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'QUARTERLY', 'ANNUAL'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setState({ recurringFrequency: f }, { recurringFrequency: f })}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      borderRadius: 5,
                      background: state.recurringFrequency === f ? 'var(--bg-0)' : 'transparent',
                      color: state.recurringFrequency === f ? 'var(--ink)' : 'var(--ink-3)',
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    {f.charAt(0) + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div
            className="mt-3.5"
            style={{
              padding: 12,
              background: 'rgba(251,191,36,0.06)',
              border: '0.5px dashed rgba(251,191,36,0.30)',
              borderRadius: 8,
            }}
          >
            <div className="field-label" style={{ color: 'var(--warn)', marginBottom: 10 }}>Forecast setup</div>
            <div className="grid grid-cols-2 gap-3.5">
              <Field
                label="Expected amount"
                hint={`This wire was ${fmtMoney(Math.abs(tx.amount))} — set the full recurring amount if it differs`}
              >
                <input
                  type="text"
                  inputMode="decimal"
                  className="num"
                  value={state.recurringExpectedAmount}
                  onChange={(e) => setState({ recurringExpectedAmount: e.target.value })}
                  onBlur={() => {
                    const num = Number(String(state.recurringExpectedAmount).replace(/[^0-9.\-]/g, ''));
                    const cents = Number.isFinite(num) && num > 0 ? Math.round(num * 100) : null;
                    setState({}, { recurringExpectedCents: cents });
                  }}
                  placeholder="6000.00"
                />
              </Field>
              <Field label="Next due date">
                <input
                  type="date"
                  value={state.recurringNextDate || ''}
                  onChange={(e) => setState({ recurringNextDate: e.target.value }, { recurringNextDate: e.target.value || null })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3.5 mt-3">
              <Field label="Forecast label">
                <input
                  type="text"
                  value={state.recurringLabel || ''}
                  onChange={(e) => setState({ recurringLabel: e.target.value })}
                  onBlur={() => setState({}, { recurringLabel: state.recurringLabel || null })}
                  placeholder="e.g. Family home rent"
                />
              </Field>
              <Field label="Alerts before due (up to 2)" hint="Pick a primary alert and an optional second alert">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={state.recurringAlertDays}
                    onChange={(e) => setState({ recurringAlertDays: Number(e.target.value) }, { recurringAlertDays: Number(e.target.value) })}
                  >
                    <option value="1">1 day before</option>
                    <option value="3">3 days before</option>
                    <option value="7">7 days before</option>
                    <option value="14">14 days before</option>
                    <option value="30">30 days before</option>
                  </select>
                  <select
                    value={state.recurringAlertDays2 ?? 0}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setState({ recurringAlertDays2: v }, { recurringAlertDays2: v || null });
                    }}
                  >
                    <option value="0">— no second alert —</option>
                    <option value="1">1 day before</option>
                    <option value="3">3 days before</option>
                    <option value="7">7 days before</option>
                    <option value="14">14 days before</option>
                    <option value="30">30 days before</option>
                  </select>
                </div>
              </Field>
            </div>
            <EntityAllocationPreview
              txId={tx.id}
              expectedAmount={Number(String(state.recurringExpectedAmount).replace(/[^0-9.\-]/g, '')) || Math.abs(tx.amount)}
              frequency={state.recurringFrequency || 'MONTHLY'}
            />
            <div
              className="mt-3 flex items-center gap-2"
              style={{
                padding: '8px 10px',
                background: 'var(--bg-3)',
                borderRadius: 6,
                fontSize: 10.5,
                color: 'var(--ink-2)',
              }}
            >
              <Calendar size={11} style={{ color: 'var(--warn)' }} />
              Will appear in your Bills Calendar and cash flow forecast starting next month
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ──────────────────── ⑤ Money flow ────────────────────
function MoneyFlowSection({
  tx, state, setState, open, setOpen, isIncome = false,
}: { tx: Transaction; state: any; setState: any; open: boolean; setOpen: () => void; isIncome?: boolean }) {
  const hideSource = false;
  // Source-of-money entity selection: drives the bank account picker on the right
  const sourceEntity: string = state.sourceEntityForPay || (() => {
    // Try to derive from sourceOfMoney string if a previous value exists
    const m = (state.moneySource || '').match(/^(.+?)\s+(revenue|investment income|funds)$/);
    if (m) {
      const ent = BUSINESS_ENTITIES.find((e) => ENTITY_LABELS[e] === m[1]);
      if (ent) return ent;
    }
    if (state.moneySource === 'Personal funds') return 'PERSONAL';
    if (state.moneySource === 'External / other') return 'EXTERNAL';
    return '';
  })();
  const accountsForEntity = sourceEntity && sourceEntity !== 'EXTERNAL'
    ? ACCOUNTS.filter((a) => a.entity === sourceEntity)
    : [];

  function pickEntity(en: string) {
    // Default the moneySource string to "<Entity> revenue" or "Personal funds" or "External / other"
    const labelFor = en === 'PERSONAL' ? 'Personal funds'
      : en === 'EXTERNAL' ? 'External / other'
      : `${ENTITY_LABELS[en as EntityType]} revenue`;
    setState(
      { sourceEntityForPay: en, moneySource: labelFor, sourceAccountForPay: '' },
      { sourceOfMoney: labelFor, sourceAccountId: null }
    );
  }

  return (
    <SectionCard
      open={open}
      setOpen={setOpen}
      title="Money flow"
      summary={
        hideSource
          ? 'Source set per split below'
          : state.moneySource ? `Source: ${state.moneySource}` : 'Not set'
      }
    >
      {/* Explainer — what this section actually models */}
      <div
        className="mb-3"
        style={{
          padding: '10px 12px',
          background: 'rgba(96,165,250,0.05)',
          border: '0.5px solid rgba(96,165,250,0.20)',
          borderRadius: 7,
          fontSize: 11,
          color: 'var(--ink-2)',
          lineHeight: 1.5,
        }}
      >
        {isIncome ? (
          <>
            Tracks the path your <b>incoming</b> cash takes. The wire landed in one entity&apos;s account, but the economic owner may be a different entity, and the money may then flow onward to a person or another entity (e.g. <i>Spacetel → Amari Holdings → Bytes AI → Mohammed&apos;s salary</i>). Pick where it lives now and where it&apos;s headed.
          </>
        ) : (
          <>
            Tracks the path the cash takes for this expense. <b>Source</b> = which entity&apos;s pool is paying. <b>Money chain</b> = where the money flows next (e.g. <i>Amari Holdings → Bytes AI → Mohammed</i> as salary). For inter-entity moves this creates the implicit loan record.
          </>
        )}
      </div>

      <div className="field-label mb-2">
        {isIncome ? 'Where this income landed' : 'Source of money to pay'}
      </div>
      <div className="grid grid-cols-2" style={{ gap: 14 }}>
        <Field label="① Entity" hint={isIncome ? 'Which entity received this cash' : "Which entity's pool is paying"}>
          <select
            value={sourceEntity}
            onChange={(e) => pickEntity(e.target.value)}
          >
            <option value="">— pick entity —</option>
            {BUSINESS_ENTITIES.map((e) => (
              <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
            ))}
            <option value="PERSONAL">Personal</option>
            <option value="EXTERNAL">External / other</option>
          </select>
        </Field>
        <Field
          label="② Bank account"
          hint={sourceEntity && sourceEntity !== 'EXTERNAL' && accountsForEntity.length === 0 ? 'no accounts on this entity yet' : `${accountsForEntity.length} account${accountsForEntity.length === 1 ? '' : 's'}`}
        >
          <select
            value={state.sourceAccountForPay || ''}
            onChange={(e) => {
              const accountId = e.target.value;
              setState({ sourceAccountForPay: accountId }, { sourceAccountId: accountId || null });
            }}
            disabled={!sourceEntity || sourceEntity === 'EXTERNAL'}
          >
            <option value="">— pick account —</option>
            {accountsForEntity.map((a) => (
              <option key={a.id} value={a.id}>···{a.last4} — {a.label}</option>
            ))}
            <option value="EXTERNAL">External / N/A</option>
          </select>
        </Field>
      </div>

      {!isIncome ? (
      <div className="mt-4">
        <Field label="Need to get from" hint="Who reimburses this account">
          <select
            value={state.needToGetFrom || ''}
            onChange={(e) => setState({ needToGetFrom: e.target.value }, { needToGetFrom: e.target.value || null })}
          >
            <option value="">No need</option>
            {BUSINESS_ENTITIES.map((e) => (
              <option key={e} value={`${ENTITY_LABELS[e]} (reimburse from)`}>{ENTITY_LABELS[e]} (reimburse from)</option>
            ))}
            <option value="Personal funds">Personal (reimburse from)</option>
          </select>
        </Field>
      </div>
      ) : null}

      {/* Money chain inset */}
      <div
        className="mt-4 p-3.5"
        style={{
          background: 'var(--bg-3)',
          border: '0.5px solid var(--border-subtle)',
          borderRadius: 8,
        }}
      >
        <div className="field-label mb-3">Money chain · who got it next?</div>
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Hop 2 · pays to person" hint="As salary / wages">
            <select
              value={state.hop2Person || ''}
              onChange={(e) => setState({ hop2Person: e.target.value }, { salaryPersonId: e.target.value || null, isSalary: !!e.target.value })}
            >
              <option value="">— stayed in entity —</option>
              {/* Person list could be threaded in; using counterparty list shortcut */}
              <option value="pending">— pick on Salary section —</option>
            </select>
          </Field>
          <Field label="Hop 3 · then forwards to" hint="Where it ultimately lands">
            <select
              value={state.hop3Entity || ''}
              onChange={(e) => setState({ hop3Entity: e.target.value, passedOnward: !!e.target.value }, { passthroughEntity: e.target.value || null })}
            >
              <option value="">— didn&apos;t flow onward —</option>
              {BUSINESS_ENTITIES.map((en) => (
                <option key={en} value={en}>{ENTITY_LABELS[en]}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </SectionCard>
  );
}

// ──────────────────── ⑥ Passed onward ────────────────────
function PassedOnwardSection({
  tx, state, setState, open, setOpen,
}: { tx: Transaction; state: any; setState: any; open: boolean; setOpen: () => void }) {
  const active = state.passedOnward;
  const summary = active && state.passthroughEntity
    ? `Economic hit: ${ENTITY_LABELS[state.passthroughEntity as EntityType] || state.passthroughEntity}`
    : 'Stayed in this entity';

  return (
    <SectionCard
      accent={active ? 'warn' : undefined}
      open={open}
      setOpen={setOpen}
      title="Passed onward"
      summary={summary}
    >
      <div className="text-[11.5px] text-ink-mute mb-3.5">
        When the wire is on one entity but the economic hit belongs to another.
      </div>

      <Field label="Was this passed onward?">
        <div className="grid grid-cols-2 gap-2">
          <PathButton
            active={!active}
            color="var(--ink-3)"
            icon={null}
            label="No — stayed here"
            onClick={() => setState({ passedOnward: false, passthroughEntity: '' }, { passthroughEntity: null })}
          />
          <PathButton
            active={active}
            color="var(--warn)"
            icon={null}
            label="Yes — hit elsewhere"
            onClick={() => setState({ passedOnward: true })}
          />
        </div>
      </Field>

      {active && (
        <>
          <div className="mt-3.5">
            <Field label="Economic hit entity">
              <EntityPicker
                value={state.passthroughEntity || 'BYTES_AI'}
                onChange={(v) => setState({ passthroughEntity: v }, { passthroughEntity: v })}
              />
            </Field>
          </div>

          {state.passthroughEntity && (
            <div className="mt-3.5 flex flex-col gap-3">
              <Field label="Onward · purpose">
                <input
                  type="text"
                  value={state.passthroughPurpose || ''}
                  onChange={(e) => setState({ passthroughPurpose: e.target.value })}
                  onBlur={() => setState({}, { passthroughPurpose: state.passthroughPurpose || null })}
                  placeholder="e.g. Pay restaurant owner debt"
                />
              </Field>

              {/* Flow chain visual */}
              <FlowChainVisual
                fromEntity={(tx.confirmedEntity || tx.entityTag) as EntityType}
                toEntity={state.passthroughEntity as EntityType}
                purpose={state.passthroughPurpose}
              />

              <Field label="Onward · notes">
                <textarea
                  rows={2}
                  value={state.passthroughNotes || ''}
                  onChange={(e) => setState({ passthroughNotes: e.target.value })}
                  onBlur={() => setState({}, { passthroughNotes: state.passthroughNotes || null })}
                  placeholder="Why was this passed onward?"
                  style={{ resize: 'vertical' }}
                />
              </Field>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

function FlowChainVisual({ fromEntity, toEntity, purpose }: { fromEntity: EntityType; toEntity: EntityType; purpose?: string }) {
  const fromColor = ENTITY_COLORS[fromEntity] || '#c9a87a';
  const toColor = ENTITY_COLORS[toEntity] || '#c9a87a';
  return (
    <div
      style={{
        padding: 16,
        background: `linear-gradient(90deg, color-mix(in oklab, ${fromColor} 8%, var(--bg-3)), color-mix(in oklab, ${toColor} 8%, var(--bg-3)))`,
        border: '0.5px solid rgba(251,191,36,0.30)',
        borderRadius: 10,
      }}
    >
      <div className="field-label" style={{ color: 'var(--warn)', marginBottom: 12 }}>Money flow chain</div>
      <div className="flex items-center gap-2">
        <FlowNode type="entity" color={fromColor} label={ENTITY_LABELS[fromEntity]} sub="pays from" />
        <FlowArrow />
        <FlowNode type="person" color="var(--purple)" label="You" sub="salary / wages" />
        <FlowArrow />
        <FlowNode type="entity" color={toColor} label={ENTITY_LABELS[toEntity]} sub="economic hit" />
      </div>
      <div
        className="text-[11px] text-ink-dim italic mt-3 pt-2.5"
        style={{ borderTop: '0.5px solid var(--border-subtle)', lineHeight: 1.5 }}
      >
        {ENTITY_LABELS[fromEntity]} pays salary, then it forwards to {ENTITY_LABELS[toEntity]}{purpose ? ` for ${purpose.toLowerCase()}` : ''}.
      </div>
    </div>
  );
}

function FlowNode({ type, color, label, sub }: { type: 'entity' | 'person'; color: string; label: string; sub: string }) {
  return (
    <div className="flex-1 text-center">
      <div
        style={{
          background: `color-mix(in oklab, ${color} 14%, var(--bg-2))`,
          border: '0.5px solid ' + color,
          borderRadius: 8,
          padding: '10px 8px',
        }}
      >
        <div
          className="grid place-items-center mx-auto mb-1.5"
          style={{ width: 26, height: 26, borderRadius: 6, background: color, color: 'var(--bg-0)' }}
        >
          {type === 'entity' ? <Building2 size={13} /> : <User size={13} />}
        </div>
        <div className="text-[11.5px] font-semibold text-ink">{label}</div>
        <div className="text-[9.5px] text-ink-mute mt-px">{sub}</div>
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="text-ink-ghost px-0.5" style={{ flex: '0 0 auto' }}>
      <ArrowRight size={14} />
    </div>
  );
}

// ──────────────────── ⑧ Notes ────────────────────
function NotesSection({
  tx, state, setState, open, setOpen, notesOnly = false,
}: {
  tx: Transaction;
  state: any;
  setState: any;
  open: boolean;
  setOpen: () => void;
  /** When true (transaction is split), collapse to a single Notes field
   *  because business purpose / doc ref / receipts live on each split. */
  notesOnly?: boolean;
}) {
  const filled = notesOnly
    ? (state.notes ? 1 : 0)
    : [state.docRef, state.notes].filter(Boolean).length;
  return (
    <SectionCard
      open={open}
      setOpen={setOpen}
      title={notesOnly ? 'Notes' : 'Notes & documentation'}
      summary={filled === 0 ? 'No notes' : `${filled} field${filled > 1 ? 's' : ''} filled`}
    >
      {!notesOnly ? (
        <>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Doc reference">
              <input
                type="text"
                value={state.docRef || ''}
                onChange={(e) => setState({ docRef: e.target.value })}
                onBlur={() => setState({}, { receiptRef: state.docRef || null })}
                placeholder="INV-123 / link to file"
              />
            </Field>
            <Field label="Receipt">
              <button type="button" className="btn w-full justify-center">
                <Paperclip size={12} /> Upload receipt
              </button>
            </Field>
          </div>
        </>
      ) : null}

      <div className={notesOnly ? '' : 'mt-3'}>
        <Field
          label="Notes"
          hint={notesOnly ? 'Per-part notes live on each split below — this field is just for general remarks.' : undefined}
        >
          <textarea
            rows={3}
            value={state.notes || ''}
            onChange={(e) => setState({ notes: e.target.value })}
            onBlur={() => setState({}, { notes: state.notes || null })}
            placeholder="Anything else worth remembering"
            style={{ resize: 'vertical' }}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

// ──────────────────── Review checklist ────────────────────
function ReviewChecklist({ state, tx }: { state: any; tx: Transaction }) {
  const items = [
    { ok: true, label: 'Dates confirmed' },
    { ok: !!state.personalOrBusiness, label: 'Personal / Business set' },
    { ok: state.personalOrBusiness === 'PERSONAL' || !!state.confirmedEntity, label: 'Entity / person chosen' },
    { ok: !!(state.businessSubCat2 || state.personalSubCat), label: 'Category selected' },
    { ok: !!state.docRef, label: 'Doc reference added' },
  ];
  return (
    <div className="px-1 pt-1">
      <div className="field-label mb-2">Completion checklist</div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5 text-[12px]">
            {it.ok ? (
              <span
                className="grid place-items-center rounded-full"
                style={{
                  width: 14,
                  height: 14,
                  background: 'rgba(74,222,128,0.15)',
                  color: 'var(--income)',
                  flex: '0 0 14px',
                }}
              >
                <Check size={9} />
              </span>
            ) : (
              <span
                className="rounded"
                style={{
                  width: 14,
                  height: 14,
                  border: '0.5px solid var(--border-default)',
                  flex: '0 0 14px',
                }}
              />
            )}
            <span
              style={{
                color: it.ok ? 'var(--ink-3)' : 'var(--ink-2)',
                textDecoration: it.ok ? 'line-through' : 'none',
              }}
            >
              {it.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────── CPA Section ────────────────────
function CPASection({
  state, setState, open, setOpen,
}: { state: any; setState: any; open: boolean; setOpen: () => void }) {
  return (
    <SectionCard
      accent="blue"
      open={open}
      setOpen={setOpen}
      icon={<Award size={13} style={{ color: 'var(--info)' }} />}
      title="CPA review"
      summary={state.cpaReviewed ? `Signed by ${state.cpaReviewerName || 'CPA'}` : 'Not yet reviewed'}
    >
      <div className="text-[11.5px] text-ink-mute mb-3.5">
        Only your CPA can sign off — appears when they log in.
      </div>
      {state.cpaReviewed ? (
        <div
          className="flex items-center gap-3 p-3"
          style={{
            background: 'rgba(96,165,250,0.07)',
            border: '0.5px solid rgba(96,165,250,0.30)',
            borderRadius: 8,
          }}
        >
          <span
            className="grid place-items-center rounded-full"
            style={{ width: 28, height: 28, background: 'rgba(96,165,250,0.18)', color: 'var(--info)' }}
          >
            <Check size={14} />
          </span>
          <div className="flex-1">
            <div className="text-[12.5px] font-semibold">Reviewed</div>
            <div className="text-[11px] text-ink-mute mt-0.5">
              {state.cpaReviewerName || 'CPA'} · {state.cpaReviewedAt || 'recent'}
            </div>
          </div>
          <span className="pill pill-blue">✓ Signed off</span>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 p-3"
          style={{ background: 'var(--bg-3)', border: '0.5px solid var(--border-subtle)', borderRadius: 8 }}
        >
          <div className="flex-1">
            <div className="text-[12.5px] font-medium">Waiting for CPA sign-off</div>
            <div className="text-[10.5px] text-ink-mute mt-0.5">CPA not signed in</div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ──────────────── Entity allocation preview (Recurrence) ────────────────
function EntityAllocationPreview({
  txId, expectedAmount, frequency,
}: { txId: string; expectedAmount: number; frequency: string }) {
  const [items, setItems] = useState<Array<{ entity: string; monthlyShare: number; sharePct: number }> | null>(null);

  useEffect(() => {
    let cancel = false;
    recurringAllocationPreviewAction(txId, expectedAmount, frequency)
      .then((rows: any[]) => { if (!cancel) setItems(rows as any); })
      .catch(() => { if (!cancel) setItems([]); });
    return () => { cancel = true; };
  }, [txId, expectedAmount, frequency]);

  if (!items || items.length === 0) return null;
  const total = items.reduce((s, x) => s + x.monthlyShare, 0);
  if (total <= 0) return null;

  return (
    <div
      className="mt-3"
      style={{
        padding: '10px 12px',
        background: 'rgba(167,139,250,0.06)',
        border: '0.5px solid rgba(167,139,250,0.25)',
        borderRadius: 8,
      }}
    >
      <div
        className="field-label"
        style={{ marginBottom: 8, color: 'var(--purple, #a78bfa)' }}
      >
        Forecast rolls up to
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => {
          const color = (ENTITY_COLORS as any)[it.entity] || '#6f6e68';
          const label = (ENTITY_LABELS as any)[it.entity] || it.entity;
          return (
            <div key={i} className="flex items-center gap-2 text-[11.5px]">
              <span style={{ width: 7, height: 7, borderRadius: 50, background: color }} />
              <span style={{ color: 'var(--ink)' }}>{label}</span>
              <span className="text-ink-mute">{(it.sharePct * 100).toFixed(0)}%</span>
              <span className="flex-1" />
              <span className="num font-medium" style={{ color: 'var(--ink)' }}>
                {fmtMoney(it.monthlyShare)}/mo
              </span>
            </div>
          );
        })}
      </div>
      {items.length > 1 ? (
        <div className="text-[10px] text-ink-mute mt-2">
          Allocated by the splits below — change a split's entity to re-route.
        </div>
      ) : null}
    </div>
  );
}

// ──────────────── Review & Escalation ────────────────
const REVIEW_STATES: Array<{
  key: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'PENDING_REVIEW',
    label: 'Pending review',
    color: 'var(--warn)',
    bg: 'rgba(251,191,36,0.10)',
    border: 'rgba(251,191,36,0.30)',
    icon: <AlertTriangle size={11} />,
  },
  {
    key: 'REVIEWED',
    label: 'Reviewed',
    color: 'var(--blue, #60a5fa)',
    bg: 'rgba(96,165,250,0.10)',
    border: 'rgba(96,165,250,0.30)',
    icon: <Check size={11} />,
  },
  {
    key: 'REVIEWED_APPROVED',
    label: 'Reviewed & approved',
    color: 'var(--income)',
    bg: 'rgba(74,222,128,0.10)',
    border: 'rgba(74,222,128,0.30)',
    icon: <ShieldCheck size={11} />,
  },
];

function ReviewSection({
  state, setState, open, setOpen,
}: { state: any; setState: any; open: boolean; setOpen: () => void }) {
  const current = REVIEW_STATES.find((s) => s.key === state.reviewState);
  const needsEsc = !!state.needsEscalation;

  function pickState(key: string) {
    const reviewedAt = key === 'PENDING_REVIEW' ? null : new Date().toISOString();
    setState(
      { reviewState: key, reviewedAt: reviewedAt || '' },
      { reviewState: key, reviewedAt: reviewedAt },
    );
  }

  const summary = current
    ? `${current.label}${state.reviewerName ? ` · ${state.reviewerName}` : ''}${needsEsc ? ' · escalation flagged' : ''}`
    : 'Not yet reviewed';

  return (
    <SectionCard
      accent={needsEsc ? 'warn' : current?.key === 'REVIEWED_APPROVED' ? 'green' : current ? 'blue' : undefined}
      open={open}
      setOpen={setOpen}
      icon={<ShieldCheck size={13} />}
      title="Review & escalation"
      summary={summary}
    >
      <div className="text-[11.5px] text-ink-mute mb-3.5">
        Track who reviewed this and whether it needs to be escalated for verification.
      </div>

      {/* State picker */}
      <div className="field-label" style={{ marginBottom: 8 }}>Status</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {REVIEW_STATES.map((s) => {
          const active = state.reviewState === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => pickState(s.key)}
              className="inline-flex items-center justify-center gap-1.5"
              style={{
                padding: '8px 10px',
                borderRadius: 7,
                background: active ? s.bg : 'var(--bg-3)',
                border: '0.5px solid ' + (active ? s.border : 'var(--border-default, rgba(255,255,255,0.12))'),
                color: active ? s.color : 'var(--ink-2)',
                fontSize: 11.5,
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              {s.icon}
              <span className="text-left">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Reviewer + when */}
      {current ? (
        <div className="grid grid-cols-2 gap-3.5 mb-4">
          <Field label="Reviewed by" hint="Pick the person on the team or add a new one">
            <PersonPicker
              value={state.reviewerName || ''}
              onChange={(name) => setState(
                { reviewerName: name },
                { reviewerName: name || null },
              )}
              placeholder="Pick reviewer"
            />
          </Field>
          <Field label="Reviewed at" hint="Auto-stamped when you change status">
            <input
              type="text"
              readOnly
              value={state.reviewedAt ? new Date(state.reviewedAt).toLocaleString() : '—'}
              className="num"
              style={{ color: 'var(--ink-2)' }}
            />
          </Field>
        </div>
      ) : null}

      {/* Escalation */}
      <div
        style={{
          padding: '10px 12px',
          background: needsEsc ? 'rgba(251,191,36,0.06)' : 'var(--bg-3)',
          border: '0.5px solid ' + (needsEsc ? 'rgba(251,191,36,0.30)' : 'var(--border-subtle, rgba(255,255,255,0.07))'),
          borderRadius: 8,
        }}
      >
        <div className="flex items-center gap-2">
          <Flag size={12} style={{ color: needsEsc ? 'var(--warn)' : 'var(--ink-3)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
              Does this need escalation?
            </div>
            <div className="text-[10.5px] text-ink-mute mt-px">
              Escalation flags this transaction for verification by another person.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const v = !needsEsc;
              setState(
                {
                  needsEscalation: v,
                  // clear escalation target when turning off
                  escalationTo: v ? state.escalationTo : '',
                  escalationNotes: v ? state.escalationNotes : '',
                },
                {
                  needsEscalation: v,
                  ...(v ? {} : { escalationTo: null, escalationNotes: null }),
                },
              );
            }}
            className="btn btn-sm"
            style={{
              background: needsEsc ? 'rgba(251,191,36,0.16)' : 'var(--bg-2)',
              borderColor: needsEsc ? 'rgba(251,191,36,0.40)' : 'var(--border-default, rgba(255,255,255,0.12))',
              color: needsEsc ? 'var(--warn)' : 'var(--ink-2)',
            }}
          >
            {needsEsc ? 'Escalation · ON' : 'No escalation'}
          </button>
        </div>

        {needsEsc ? (
          <div className="flex flex-col mt-3" style={{ gap: 10 }}>
            <Field label="Escalate to" hint="Who needs to verify this">
              <PersonPicker
                value={state.escalationTo || ''}
                onChange={(name) => setState(
                  { escalationTo: name },
                  { escalationTo: name || null },
                )}
                placeholder="Pick verifier"
              />
            </Field>
            <Field label="Escalation notes · optional">
              <textarea
                rows={2}
                value={state.escalationNotes || ''}
                onChange={(e) => setState({ escalationNotes: e.target.value })}
                onBlur={() => setState({}, { escalationNotes: state.escalationNotes || null })}
                placeholder="What needs to be verified or clarified?"
                style={{ fontSize: 12, resize: 'vertical', minHeight: 50 }}
              />
            </Field>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

// ──────────── Capital Investment → Commitment picker ────────────
interface CommitmentLite {
  id: string;
  entity: string;
  personId: string;
  personName: string | null;
  totalAmountCents: number;
  monthlyAmountCents: number | null;
  fundedCents: number;
  remainingCents: number;
  pctFunded: number;
}

function CommitmentPicker({
  value, entity, personName, onChange,
}: {
  value: string;
  entity: string | null;
  personName: string;
  onChange: (commitmentId: string | null) => void;
}) {
  const [commitments, setCommitments] = useState<CommitmentLite[]>([]);

  useEffect(() => {
    let cancel = false;
    fetch('/api/commitments', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { if (!cancel) setCommitments(d.commitments || []); })
      .catch(() => { if (!cancel) setCommitments([]); });
    return () => { cancel = true; };
  }, []);

  const scoped = commitments.filter((c) => c.entity === entity);
  const otherEntity = commitments.filter((c) => c.entity !== entity);
  const selected = commitments.find((c) => c.id === value) || null;

  // Best-guess match suggestion: same entity + same person name
  const suggested = !value && personName
    ? scoped.find((c) => c.personName?.toLowerCase() === personName.toLowerCase())
    : null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: '12px 14px',
        background: 'rgba(167,139,250,0.06)',
        border: '0.5px solid rgba(167,139,250,0.30)',
        borderRadius: 8,
      }}
    >
      <div className="field-label" style={{ marginBottom: 6, color: 'var(--purple)' }}>
        Investor commitment
      </div>
      <div className="text-[11.5px] text-ink-mute mb-2">
        Tie this wire to the master commitment so the remaining balance + monthly
        tranches update automatically. Set up commitments on /cap or /team.
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ fontSize: 12 }}
      >
        <option value="">— no commitment linked —</option>
        {scoped.length > 0 ? (
          <optgroup label={`${(ENTITY_LABELS as any)[entity || ''] || entity || 'This entity'} commitments`}>
            {scoped.map((c) => (
              <option key={c.id} value={c.id}>
                {c.personName || '—'} · ${(c.totalAmountCents / 100).toLocaleString()} total
                {c.monthlyAmountCents ? ` · $${(c.monthlyAmountCents / 100).toLocaleString()}/mo` : ''}
              </option>
            ))}
          </optgroup>
        ) : null}
        {otherEntity.length > 0 ? (
          <optgroup label="Other entities">
            {otherEntity.map((c) => (
              <option key={c.id} value={c.id}>
                {c.personName || '—'} · {(ENTITY_LABELS as any)[c.entity] || c.entity} · ${(c.totalAmountCents / 100).toLocaleString()}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>

      {suggested ? (
        <button
          type="button"
          onClick={() => onChange(suggested.id)}
          className="btn btn-sm mt-2"
          style={{
            background: 'rgba(167,139,250,0.12)',
            borderColor: 'rgba(167,139,250,0.40)',
            color: 'var(--purple)',
            fontSize: 11,
          }}
        >
          Match → {suggested.personName} · ${(suggested.totalAmountCents / 100).toLocaleString()} commitment
        </button>
      ) : null}

      {selected ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-ink-mute">
              {selected.personName} ·{' '}
              {(ENTITY_LABELS as any)[selected.entity] || selected.entity}
            </span>
            <span className="num font-medium" style={{ color: 'var(--ink)' }}>
              {fmtMoney(selected.fundedCents / 100)} of {fmtMoney(selected.totalAmountCents / 100)}
              <span className="text-ink-mute">{' · '}{Math.round(selected.pctFunded * 100)}%</span>
            </span>
          </div>
          <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, selected.pctFunded * 100)}%`,
                height: '100%',
                background: selected.pctFunded >= 1
                  ? 'var(--income)'
                  : 'linear-gradient(90deg, var(--purple), color-mix(in oklab, var(--purple) 60%, var(--gold)))',
                transition: 'width 220ms ease',
              }}
            />
          </div>
          {selected.monthlyAmountCents ? (
            <div className="text-[10.5px] text-ink-mute mt-2">
              Monthly tranche target:{' '}
              <span className="num text-ink">${(selected.monthlyAmountCents / 100).toLocaleString()}</span>{' '}
              · Remaining{' '}
              <span className="num text-ink">{fmtMoney(selected.remainingCents / 100)}</span>
            </div>
          ) : (
            <div className="text-[10.5px] text-ink-mute mt-2">
              Remaining{' '}
              <span className="num text-ink">{fmtMoney(selected.remainingCents / 100)}</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
