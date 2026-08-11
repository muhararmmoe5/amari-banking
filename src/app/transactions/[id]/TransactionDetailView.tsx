'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, CreditCard, Sparkles, RotateCcw,
  Split as SplitIcon, User, Building2, AlertTriangle, Repeat,
} from 'lucide-react';
import type { Transaction, EntityType } from '@/types';
import { ENTITY_LABELS, ENTITY_COLORS, BUSINESS_ENTITIES } from '@/constants/accounts';
import {
  PERSONAL_CATEGORIES, BUSINESS_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES, BUSINESS_INCOME_CATEGORIES,
} from '@/constants/categories';
import { saveTransaction, deleteTransactionAction, flagForIdentificationAction } from '../actions';
import { Trash2, UserSearch } from 'lucide-react';
import BackToTransactionsLink from '../BackToTransactionsLink';
import PersonPicker from '@/components/PersonPicker';
import { CUSTOM_CATEGORY_PRESETS } from '@/constants/custom-categories';
import { useToast } from '@/components/Toast';
import BankChip from '@/components/BankChip';
import DrawerSplitEditor from '../DrawerSplitEditor';
import { fmtMoney } from '@/lib/format';

interface AccountLite { id: string; label: string; entity: EntityType; last4: string }
interface FifoSource { txId: string; merchant: string; amount: number; accountId: string; date: string; isInternal: boolean; attributedAmount: number; ownerLabel: string | null }
interface DownstreamConsumer { txId: string; date: string; merchant: string | null; description: string; amountFromThisInflow: number; expenseAmount: number }
interface DownstreamTrace { totalSpent: number; remaining: number; pctSpent: number; consumers: DownstreamConsumer[] }
interface SplitSummary {
  id: string;
  amountCents: number;
  entity: string;
  subCategory1: string | null;
  subCategory2: string | null;
  individual: string | null;
  notes: string | null;
}

interface FlagInfo { level: 'critical' | 'high' | 'medium' | 'low'; label: string; color: string }
function flagFor(score: number | null | undefined): FlagInfo {
  const s = score || 0;
  if (s >= 80) return { level: 'critical', label: 'Critical', color: '#d18876' };
  if (s >= 60) return { level: 'high', label: 'High', color: '#e89859' };
  if (s >= 30) return { level: 'medium', label: 'Medium', color: '#d4b16f' };
  return { level: 'low', label: 'Low', color: '#6f6e68' };
}

export default function TransactionDetailView({
  tx, account, fifoSource, fifoSources = [], sourceIsOverride, txOwnerLabel, downstream,
  viewerIsEditor = true, initialSplitCount, initialSplitSummary,
}: {
  tx: Transaction;
  account: AccountLite | null;
  fifoSource: FifoSource | null;
  /** All prior inflows the FIFO trace attributes to this expense —
   *  in FIFO consumption order. Can be more than one when the expense
   *  drained multiple deposits. Empty when the FIFO trace found none
   *  or when a manual override is in place (in which case fifoSource
   *  holds the single override). */
  fifoSources?: FifoSource[];
  sourceIsOverride?: boolean;
  txOwnerLabel?: string | null;
  downstream?: DownstreamTrace | null;
  /** Full editor privileges vs claimant-only view. Defaults to full. */
  viewerIsEditor?: boolean;
  initialSplitCount: number;
  initialSplitSummary: SplitSummary[];
}) {
  const router = useRouter();
  const { saveStart, saveEnd, saveError } = useToast();
  const [, startTx] = useTransition();

  const isIncome = tx.amount > 0;
  const isExpense = tx.amount < 0;

  const [path, setPath] = useState<'PERSONAL' | 'BUSINESS' | null>(
    tx.confirmedEntity === 'PERSONAL' ? 'PERSONAL'
    : tx.confirmedEntity ? 'BUSINESS'
    : null,
  );
  const [entity, setEntity] = useState<string>((tx.confirmedEntity || tx.entityTag || 'BYTES_AI'));
  const [businessDepartment, setBusinessDepartment] = useState<string>(tx.businessDepartment || '');
  const [businessCat1Key, setBusinessCat1Key] = useState<string>(tx.businessCat1Key || '');
  const [personalCat1Key, setPersonalCat1Key] = useState<string>(tx.personalCat1Key || '');
  const [businessSubCat2, setBusinessSubCat2] = useState<string>(tx.subCategory2 || '');
  const [personalSubCat2, setPersonalSubCat2] = useState<string>(tx.subCategory2 || '');
  const [individual, setIndividual] = useState<string>(tx.individual || '');
  const [docRef, setDocRef] = useState<string>(tx.receiptRef || '');
  const [customSourceTag, setCustomSourceTag] = useState<string>(tx.customSourceTag || '');
  const [customCategory, setCustomCategory] = useState<string>(tx.customCategory || '');
  const [customCategoryDescription, setCustomCategoryDescription] = useState<string>(tx.customCategoryDescription || '');
  const [notes, setNotes] = useState<string>(tx.notes || '');
  // Older rows may not have a bookingDateMode column populated. Infer
  // it from the tagged_date shape: full YYYY-MM-DD means DAY mode; a
  // month-first-of value or missing tag defaults to MONTH. Previously
  // this always defaulted to MONTH and silently rewrote a DAY tag to
  // the first of the month the moment the user toggled the switch.
  const inferredMode: 'DAY' | 'MONTH' = tx.bookingDateMode as 'DAY' | 'MONTH'
    || (tx.taggedDate && /^\d{4}-\d{2}-\d{2}$/.test(tx.taggedDate) && !tx.taggedDate.endsWith('-01') ? 'DAY' : 'MONTH');
  const [bookingDateMode, setBookingDateMode] = useState<'DAY' | 'MONTH'>(inferredMode);
  const [taggedDate, setTaggedDate] = useState<string>(tx.taggedDate || '');
  // Default to split=true when this transaction already has split rows saved.
  // Earlier categorization persists in transaction_splits — surface it instead
  // of hiding it.
  const [isSplit, setIsSplit] = useState(initialSplitCount > 0);
  const [editingSplits, setEditingSplits] = useState(false);
  const splitTotal = initialSplitSummary.reduce((s, x) => s + Math.abs(x.amountCents), 0) / 100;

  const [isRecurring, setIsRecurring] = useState<boolean>(!!tx.isRecurring);
  const [recurringFrequency, setRecurringFrequency] = useState<string>(tx.recurringFrequency || 'MONTHLY');
  const [recurringNextDate, setRecurringNextDate] = useState<string>(tx.recurringNextDate || '');
  const [recurringLabel, setRecurringLabel] = useState<string>(tx.recurringLabel || '');
  const [recurringExpectedStr, setRecurringExpectedStr] = useState<string>(
    tx.recurringExpectedCents != null ? (tx.recurringExpectedCents / 100).toFixed(2) : ''
  );

  function persist(patch: any) {
    const id = saveStart();
    startTx(async () => {
      try { await saveTransaction(tx.id, patch); saveEnd(id); }
      catch (e: any) { saveError(id, e?.message); }
    });
  }

  // Keyboard shortcuts at the route root
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') router.push('/transactions');
      else if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); /* autosave already handles */ }
      else if (e.key.toLowerCase() === 'c') persist({ auditStatus: 'CONFIRMED', reviewState: 'REVIEWED_APPROVED', reviewedAt: new Date().toISOString() });
      else if (e.key.toLowerCase() === 'p') persist({ auditStatus: 'PERSONAL_NO_DEDUCT', confirmedEntity: 'PERSONAL' });
      else if (e.key.toLowerCase() === 'r') persist({ auditStatus: 'NEEDS_RECEIPT' });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickPath(p: 'PERSONAL' | 'BUSINESS') {
    // Toggle-off if the user taps the same path they're already on —
    // clears the entity + resets the sub-category state so nothing
    // sits stale in the form.
    if (path === p) {
      setPath(null);
      setEntity('UNKNOWN' as EntityType);
      setBusinessCat1Key('');
      setBusinessSubCat2('');
      setPersonalCat1Key('');
      setPersonalSubCat2('');
      persist({
        confirmedEntity: null,
        businessCat1Key: null,
        personalCat1Key: null,
        subCategory2: null,
      });
      return;
    }
    setPath(p);
    if (p === 'PERSONAL') {
      setEntity('PERSONAL');
      persist({ confirmedEntity: 'PERSONAL' });
    } else {
      const next = BUSINESS_ENTITIES.includes(entity as EntityType) ? entity : 'BYTES_AI';
      setEntity(next);
      persist({ confirmedEntity: next as EntityType });
    }
  }

  function pickBusinessCategory(key: string) {
    setBusinessCat1Key(key);
    setBusinessSubCat2('');
    persist({ businessCat1Key: key, subCategory2: null });
  }
  function pickPersonalCategory(key: string) {
    setPersonalCat1Key(key);
    setPersonalSubCat2('');
    persist({ personalCat1Key: key, subCategory2: null });
  }

  const flag = flagFor(tx.auditScore);
  const businessCats = isIncome ? BUSINESS_INCOME_CATEGORIES : BUSINESS_CATEGORIES;
  const personalCats = isIncome ? PERSONAL_INCOME_CATEGORIES : PERSONAL_CATEGORIES;

  const merchantTitle = tx.merchantName || tx.description.slice(0, 60);
  const firstWord = merchantTitle.split(/\s+/)[0];
  const restWords = merchantTitle.split(/\s+/).slice(1).join(' ');

  return (
    <>
      {/* Sticky top action bar */}
      <div
        className="sticky top-0 z-30 flex items-center flex-wrap tx-topbar"
        style={{
          padding: '14px 36px',
          gap: 10,
          background: 'var(--bg-0, #0a0a0c)',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        {viewerIsEditor ? (
          <BackToTransactionsLink className="btn btn-ghost btn-sm" />
        ) : (
          <Link href="/identify" className="btn btn-ghost btn-sm">
            <ArrowLeft size={12} /> Back to my queue
          </Link>
        )}
        <span style={{ flex: 1 }} />
        {/* Prev / Next were rendered permanently disabled with no wiring —
            removed until they have a real cursor-through-list handler. */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ color: 'var(--expense)' }}
          onClick={() => persist({ auditStatus: 'PERSONAL_NO_DEDUCT', confirmedEntity: 'PERSONAL' })}
        >
          Personal · skip
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => persist({ auditStatus: 'NEEDS_RECEIPT' })}
        >
          Needs receipt
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => persist({ auditStatus: 'CONFIRMED', reviewState: 'REVIEWED_APPROVED', reviewedAt: new Date().toISOString() })}
        >
          <Check size={12} /> Confirm tag
        </button>
      </div>

      {/* Two-column body — stacks vertically on mobile */}
      <div
        className="grid tx-detail-2col"
        style={{ gridTemplateColumns: '1fr 380px', borderBottom: '1px solid rgba(255,255,255,0.055)' }}
      >
        {/* ── LEFT MAIN COLUMN ─────────────────────────────────────── */}
        <div
          className="tx-detail-main-pad"
          style={{
            padding: '36px 36px 32px',
            borderRight: '1px solid rgba(255,255,255,0.055)',
            position: 'relative',
          }}
        >
          {/* Transaction header */}
          <div className="flex items-start tx-header-row" style={{ gap: 18, marginBottom: 28 }}>
            <div
              className="grid place-items-center"
              style={{
                width: 54, height: 54, borderRadius: 14,
                background: 'linear-gradient(135deg, color-mix(in oklab, var(--gold) 20%, var(--bg-2, #16161a)), var(--bg-3, #1c1c21))',
                border: '0.5px solid color-mix(in oklab, var(--gold) 30%, rgba(255,255,255,0.055))',
                color: 'var(--gold)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 8px 20px -8px rgba(0,0,0,.4)',
              }}
            >
              <CreditCard size={22} strokeWidth={1.4} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: '.16em', color: 'var(--gold)', marginBottom: 6,
                }}
              >
                Banking / Transactions / Detail
              </div>
              <div
                style={{
                  fontSize: 22, fontWeight: 500, letterSpacing: '-.02em',
                  lineHeight: 1.1, color: 'var(--ink)',
                }}
              >
                <em
                  style={{
                    fontFamily: 'var(--font-serif, "Instrument Serif", serif)',
                    fontStyle: 'italic',
                    color: 'var(--gold)',
                    fontWeight: 400,
                  }}
                >
                  {firstWord}
                </em>
                {restWords ? ' ' + restWords : ''}
              </div>
              <div
                className="num"
                style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)', maxWidth: 480, lineHeight: 1.5 }}
              >
                {tx.description}
              </div>
              <div className="flex flex-wrap items-center" style={{ marginTop: 18, columnGap: 8, rowGap: 12 }}>
                <BankChip bank="CHASE" monogram="J" mask={account?.last4 || tx.accountId} />
                {account ? (
                  <span style={{ color: 'var(--ink-2)', fontSize: 11.5 }}>{account.label}</span>
                ) : null}
                <span style={{ color: 'var(--ink-4, #44443f)' }}>·</span>
                <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>
                  Posted <span className="num">{tx.postingDate}</span>
                </span>
                {tx.balance != null ? (
                  <>
                    <span style={{ color: 'var(--ink-4, #44443f)' }}>·</span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>
                      Balance after <span className="num">${tx.balance.toLocaleString()}</span>
                    </span>
                  </>
                ) : null}
                {tx.type ? (
                  <>
                    <span style={{ color: 'var(--ink-4, #44443f)' }}>·</span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>
                      Type <span style={{ color: 'var(--ink-2)' }}>{tx.type}</span>
                    </span>
                  </>
                ) : null}
                {txOwnerLabel ? (
                  <span
                    className="pill"
                    style={{
                      fontSize: 11,
                      padding: '2.5px 8px',
                      marginLeft: 4,
                      color: 'var(--gold)',
                      background: 'color-mix(in oklab, var(--gold) 9%, transparent)',
                      border: '1px solid color-mix(in oklab, var(--gold) 30%, rgba(255,255,255,0.06))',
                      borderRadius: 999,
                    }}
                  >
                    <span style={{ color: 'var(--ink-4, #44443f)', marginRight: 5 }}>Owner</span>
                    {txOwnerLabel}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="tx-header-amount" style={{ textAlign: 'right' }}>
              <div
                className="num tx-amount-number"
                style={{
                  fontSize: 48, fontWeight: 500, letterSpacing: '-.04em',
                  lineHeight: 1,
                  color: isExpense ? 'var(--expense)' : 'var(--income)',
                }}
              >
                {isExpense ? '−$' : '+$'}
                {Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ marginTop: 8 }}>
                <FlagPill flag={flag} score={tx.auditScore || 0} />
              </div>
            </div>
          </div>

          {/* Three-date row — Charge / Posted / Booked */}
          <DatesSection
            tx={tx}
            bookingDateMode={bookingDateMode}
            taggedDate={taggedDate}
            onModeChange={(mode) => {
              setBookingDateMode(mode);
              // If switching to MONTH and we have a day value, normalize to the 1st
              if (mode === 'MONTH' && taggedDate && taggedDate.length === 10 && !taggedDate.endsWith('-01')) {
                const m = taggedDate.slice(0, 7) + '-01';
                setTaggedDate(m);
                persist({ bookingDateMode: mode, taggedDate: m });
              } else {
                persist({ bookingDateMode: mode });
              }
            }}
            onTaggedDateChange={(v) => {
              setTaggedDate(v);
              persist({ taggedDate: v || null });
            }}
          />

          {/* AI Source trace card — only for expenses, admins only.
              Team members are explicitly locked out of source-of-money
              editing — they only categorize/annotate their own row. */}
          {isExpense && viewerIsEditor ? (
            <AiSourceTraceCard
              tx={tx}
              fifoSource={fifoSource}
              fifoSources={fifoSources}
              sourceIsOverride={!!sourceIsOverride}
            />
          ) : null}

          {/* Income usage bar + downstream trace — only for income transactions, admins only */}
          {isIncome && downstream && viewerIsEditor ? (
            <DownstreamUsageCard tx={tx} downstream={downstream} />
          ) : null}

          {/* Split decision + summary — editors only.
              Claimants (cofounders) don't touch splits; the server rejects
              their writes anyway (splitActions is hasEditAccess-gated). */}
          {viewerIsEditor ? (
          <SectionEm
            title="Split transaction"
            emFirst="Split"
            sub={isSplit
              ? `${initialSplitCount} part${initialSplitCount === 1 ? '' : 's'} · $${splitTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} allocated`
              : 'Decide first — then categorize each part'}
          >
            <div className="grid grid-cols-2" style={{ gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsSplit(false)}
                style={pathBtnStyle(!isSplit, 'var(--ink-3)')}
              >
                <Check size={13} style={{ opacity: !isSplit ? 1 : 0.4 }} />
                One charge · one categorization
                {!isSplit ? <span style={{ marginLeft: 'auto', fontSize: 11 }}>●</span> : null}
              </button>
              <button
                type="button"
                onClick={() => setIsSplit(true)}
                style={pathBtnStyle(isSplit, 'var(--purple)')}
              >
                <SplitIcon size={13} />
                Split this charge
                {isSplit ? <Check size={12} style={{ marginLeft: 'auto' }} /> : null}
              </button>
            </div>

            {isSplit && initialSplitSummary.length > 0 ? (
              <div style={{ marginTop: 18 }}>
                <div className="flex flex-col" style={{ gap: 8 }}>
                  {initialSplitSummary.map((s, i) => {
                    const color = ['var(--purple)', 'var(--gold)', '#7a9fc9', 'var(--income)'][i % 4];
                    const entityLabel = (ENTITY_LABELS as any)[s.entity] || s.entity;
                    return (
                      <div
                        key={s.id}
                        style={{
                          padding: '12px 14px 12px 12px',
                          background: 'var(--bg-2, #16161a)',
                          border: '0.5px solid rgba(255,255,255,0.055)',
                          borderLeft: `3px solid ${color}`,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <span
                          className="grid place-items-center"
                          style={{
                            width: 22, height: 22, borderRadius: 50,
                            background: color, color: 'var(--bg-0, #0a0a0c)',
                            fontWeight: 700, fontSize: 10.5,
                          }}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center" style={{ gap: 8, fontSize: 12, color: 'var(--ink)' }}>
                            <span style={{ fontWeight: 500 }}>{entityLabel}</span>
                            {s.subCategory1 ? (
                              <>
                                <span style={{ color: 'var(--ink-4, #44443f)' }}>·</span>
                                <span style={{ color: 'var(--ink-2)' }}>{s.subCategory1}</span>
                              </>
                            ) : null}
                            {s.subCategory2 ? (
                              <>
                                <span style={{ color: 'var(--ink-4, #44443f)' }}>·</span>
                                <span style={{ color: 'var(--ink-2)' }}>{s.subCategory2}</span>
                              </>
                            ) : null}
                          </div>
                          {(s.individual || s.notes) ? (
                            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 }}>
                              {s.individual ? <span>{s.individual}</span> : null}
                              {s.individual && s.notes ? <span style={{ color: 'var(--ink-4, #44443f)' }}> · </span> : null}
                              {s.notes ? <span>{s.notes.slice(0, 80)}{s.notes.length > 80 ? '…' : ''}</span> : null}
                            </div>
                          ) : null}
                        </div>
                        <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                          ${(Math.abs(s.amountCents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center" style={{ marginTop: 12, gap: 10, fontSize: 11, color: 'var(--ink-3)' }}>
                  <Check size={11} style={{ color: 'var(--income)' }} />
                  <span>
                    Allocated{' '}
                    <span className="num" style={{ color: 'var(--ink-2)' }}>
                      ${splitTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    {' '}of{' '}
                    <span className="num" style={{ color: 'var(--ink-2)' }}>
                      {fmtMoney(Math.abs(tx.amount))}
                    </span>
                  </span>
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={() => setEditingSplits((v) => !v)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--purple)' }}
                  >
                    {editingSplits ? 'Done editing' : 'Edit splits'}
                  </button>
                </div>

                {editingSplits ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 16,
                      background: 'rgba(167,139,250,0.04)',
                      border: '1px solid rgba(167,139,250,0.25)',
                      borderRadius: 10,
                    }}
                  >
                    <DrawerSplitEditor
                      transactionId={tx.id}
                      transactionAmount={tx.amount}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {isSplit && initialSplitSummary.length === 0 ? (
              <div style={{ marginTop: 14 }}>
                <DrawerSplitEditor
                  transactionId={tx.id}
                  transactionAmount={tx.amount}
                />
              </div>
            ) : null}
          </SectionEm>
          ) : null}

          {/* Recurrence: one-time vs recurring + frequency — editors only. */}
          {viewerIsEditor ? (
          <SectionEm
            title="Recurrence & forecast"
            emFirst="Recurrence"
            sub={isRecurring
              ? `Recurring · ${recurringFrequency.toLowerCase()}${recurringNextDate ? ` · next ${recurringNextDate}` : ''}`
              : 'One-time charge'}
          >
            <div className="grid grid-cols-2" style={{ gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setIsRecurring(false);
                  persist({ isRecurring: false });
                }}
                style={pathBtnStyle(!isRecurring, 'var(--ink-3)')}
              >
                <Check size={13} style={{ opacity: !isRecurring ? 1 : 0.4 }} />
                One-time charge
                {!isRecurring ? <span style={{ marginLeft: 'auto', fontSize: 11 }}>●</span> : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRecurring(true);
                  persist({ isRecurring: true, recurringFrequency: recurringFrequency || 'MONTHLY' });
                }}
                style={pathBtnStyle(isRecurring, 'var(--warn, #d4b16f)')}
              >
                <Repeat size={13} style={{ opacity: isRecurring ? 1 : 0.4 }} />
                Recurring charge
                {isRecurring ? <span style={{ marginLeft: 'auto', fontSize: 11 }}>●</span> : null}
              </button>
            </div>

            {isRecurring ? (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
                  Frequency
                </div>
                <div
                  className="flex gap-1 p-0.5"
                  style={{
                    background: 'var(--bg-3)',
                    border: '0.5px solid rgba(255,255,255,0.06)',
                    borderRadius: 7,
                    marginBottom: 18,
                  }}
                >
                  {['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'QUARTERLY', 'ANNUAL'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => { setRecurringFrequency(f); persist({ recurringFrequency: f }); }}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        borderRadius: 5,
                        background: recurringFrequency === f ? 'var(--bg-0)' : 'transparent',
                        color: recurringFrequency === f ? 'var(--ink)' : 'var(--ink-3)',
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {f.charAt(0) + f.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3" style={{ gap: 16 }}>
                  <label>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                      Expected amount
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={recurringExpectedStr}
                      onChange={(e) => setRecurringExpectedStr(e.target.value)}
                      onBlur={() => {
                        const n = Number(recurringExpectedStr.replace(/[^0-9.\-]/g, ''));
                        const cents = Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
                        persist({ recurringExpectedCents: cents });
                      }}
                      placeholder={Math.abs(tx.amount).toFixed(2)}
                    />
                  </label>
                  <label>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                      Next due date
                    </div>
                    <input
                      type="date"
                      value={recurringNextDate}
                      onChange={(e) => {
                        setRecurringNextDate(e.target.value);
                        persist({ recurringNextDate: e.target.value || null });
                      }}
                    />
                  </label>
                  <label>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                      Label
                    </div>
                    <input
                      type="text"
                      value={recurringLabel}
                      onChange={(e) => setRecurringLabel(e.target.value)}
                      onBlur={() => persist({ recurringLabel: recurringLabel || null })}
                      placeholder="e.g. Family home rent"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </SectionEm>
          ) : null}

          {/* Books to — hidden when split (each part carries its own) */}
          {!isSplit ? (
          <SectionEm
            title="Books to"
            emFirst="Books"
            sub="Where this transaction lands on your P&L"
            right={
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  fontSize: 10.5, color: 'var(--gold)', padding: '3px 8px',
                  borderRadius: 6, border: '1px solid color-mix(in oklab, var(--gold) 26%, rgba(255,255,255,0.055))',
                  background: 'color-mix(in oklab, var(--gold) 8%, var(--bg-2, #16161a))',
                }}
              >
                <Sparkles size={10} /> AI suggested
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 18 }}>
              <button
                type="button"
                onClick={() => pickPath('PERSONAL')}
                style={pathBtnStyle(path === 'PERSONAL', 'var(--purple)')}
              >
                <User size={14} />
                Personal
                {path === 'PERSONAL' ? <Check size={12} style={{ marginLeft: 'auto' }} /> : null}
              </button>
              <button
                type="button"
                onClick={() => pickPath('BUSINESS')}
                style={pathBtnStyle(path === 'BUSINESS', 'var(--gold)')}
              >
                <Building2 size={14} />
                Business
                {path === 'BUSINESS' ? <Check size={12} style={{ marginLeft: 'auto' }} /> : null}
              </button>
            </div>

            {path === 'BUSINESS' ? (
              <>
                <div className="grid grid-cols-2" style={{ gap: 14, marginBottom: 14 }}>
                  <div>
                    <FieldLabel gold>Entity</FieldLabel>
                    <select
                      className="fld-in"
                      value={entity}
                      onChange={(e) => { setEntity(e.target.value); persist({ confirmedEntity: e.target.value as EntityType }); }}
                      style={fieldInStyle}
                    >
                      {BUSINESS_ENTITIES.map((k) => (
                        <option key={k} value={k}>{ENTITY_LABELS[k]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Department · optional</FieldLabel>
                    <select
                      value={businessDepartment}
                      onChange={(e) => { setBusinessDepartment(e.target.value); persist({ businessDepartment: e.target.value || null }); }}
                      style={fieldInStyle}
                    >
                      <option value="">— optional —</option>
                      {['Engineering', 'Product', 'Sales & Marketing', 'Operations', 'G&A', 'Customer Success'].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <FieldLabel>Category · quick pick</FieldLabel>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {Object.entries(businessCats).map(([k, c]) => (
                    <CategoryChip
                      key={k}
                      active={businessCat1Key === k}
                      onClick={() => pickBusinessCategory(k)}
                      color="var(--gold)"
                    >
                      {c.label}
                    </CategoryChip>
                  ))}
                  <CategoryChip
                    active={businessCat1Key === '__CUSTOM__'}
                    onClick={() => pickBusinessCategory('__CUSTOM__')}
                    color="var(--gold)"
                  >
                    + Custom
                  </CategoryChip>
                </div>

                {businessCat1Key === '__CUSTOM__' ? (
                  <CustomCategoryInputs
                    name={customCategory}
                    desc={customCategoryDescription}
                    onNameChange={setCustomCategory}
                    onDescChange={setCustomCategoryDescription}
                    onNameBlur={() => persist({ customCategory: customCategory || null })}
                    onDescBlur={() => persist({ customCategoryDescription: customCategoryDescription || null })}
                    tone="var(--gold)"
                    path="BUSINESS"
                  />
                ) : businessCat1Key && businessCats[businessCat1Key] ? (
                  <div style={{ marginTop: 14 }}>
                    <FieldLabel>Sub-category</FieldLabel>
                    <select
                      value={businessSubCat2}
                      onChange={(e) => { setBusinessSubCat2(e.target.value); persist({ subCategory2: e.target.value || null }); }}
                      style={fieldInStyle}
                    >
                      <option value="">— pick sub-category —</option>
                      {businessCats[businessCat1Key].subs.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </>
            ) : path === 'PERSONAL' ? (
              <>
                <div className="grid grid-cols-2" style={{ gap: 14, marginBottom: 14 }}>
                  <div>
                    <FieldLabel gold>Whose</FieldLabel>
                    <PersonPicker
                      value={individual}
                      onChange={(name) => {
                        setIndividual(name);
                        persist({ individual: name || null });
                      }}
                      placeholder="Pick a team member"
                    />
                  </div>
                  {viewerIsEditor ? (
                    <div>
                      <FieldLabel>Counterparty</FieldLabel>
                      {/* Bound to customSourceTag — the 'source of money'
                          field. Admins only per the two-role model. */}
                      <input
                        type="text"
                        value={customSourceTag}
                        onChange={(e) => setCustomSourceTag(e.target.value)}
                        onBlur={() => persist({ customSourceTag: customSourceTag || null })}
                        placeholder="Who got paid"
                        style={fieldInStyle}
                      />
                    </div>
                  ) : null}
                </div>

                <FieldLabel>Category · quick pick</FieldLabel>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {Object.entries(personalCats).map(([k, c]) => (
                    <CategoryChip
                      key={k}
                      active={personalCat1Key === k}
                      onClick={() => pickPersonalCategory(k)}
                      color="var(--purple)"
                    >
                      {c.label}
                    </CategoryChip>
                  ))}
                  <CategoryChip
                    active={personalCat1Key === '__CUSTOM__'}
                    onClick={() => pickPersonalCategory('__CUSTOM__')}
                    color="var(--purple)"
                  >
                    + Custom
                  </CategoryChip>
                </div>

                {personalCat1Key === '__CUSTOM__' ? (
                  <CustomCategoryInputs
                    name={customCategory}
                    desc={customCategoryDescription}
                    onNameChange={setCustomCategory}
                    onDescChange={setCustomCategoryDescription}
                    onNameBlur={() => persist({ customCategory: customCategory || null })}
                    onDescBlur={() => persist({ customCategoryDescription: customCategoryDescription || null })}
                    tone="var(--purple)"
                    path="PERSONAL"
                  />
                ) : personalCat1Key && personalCats[personalCat1Key] ? (
                  <div style={{ marginTop: 14 }}>
                    <FieldLabel>Sub-category</FieldLabel>
                    <select
                      value={personalSubCat2}
                      onChange={(e) => { setPersonalSubCat2(e.target.value); persist({ subCategory2: e.target.value || null }); }}
                      style={fieldInStyle}
                    >
                      <option value="">— pick sub-category —</option>
                      {personalCats[personalCat1Key].subs.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </>
            ) : (
              <div
                style={{
                  textAlign: 'center', padding: '24px 0',
                  fontSize: 12, color: 'var(--ink-3)',
                }}
              >
                Pick a path to start tagging.
              </div>
            )}
          </SectionEm>
          ) : null}

          {/* Notes & documentation — hidden when split (per-part notes live in the split editor) */}
          {!isSplit ? (
          <SectionEm
            title="Notes & documentation"
            emFirst="Notes"
            sub="CPA-ready purpose, receipt, reference"
          >
            <div className="grid grid-cols-2" style={{ gap: 14 }}>
              <div>
                <FieldLabel>Doc reference</FieldLabel>
                <input
                  type="text"
                  value={docRef}
                  onChange={(e) => setDocRef(e.target.value)}
                  onBlur={() => persist({ receiptRef: docRef || null })}
                  placeholder="INV-1234 · link"
                  style={fieldInStyle}
                />
              </div>
              <div>
                <FieldLabel>Individual</FieldLabel>
                <PersonPicker
                  value={individual}
                  onChange={(name) => {
                    setIndividual(name);
                    persist({ individual: name || null });
                  }}
                  placeholder="Pick or add a person"
                />
              </div>
              {viewerIsEditor ? (
                <div style={{ gridColumn: 'span 2' }}>
                  <FieldLabel>
                    Custom source tag{' '}
                    <span style={{ color: 'var(--ink-4, #44443f)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      — the specific client / project / purpose behind this row
                    </span>
                  </FieldLabel>
                  <input
                    type="text"
                    value={customSourceTag}
                    onChange={(e) => setCustomSourceTag(e.target.value)}
                    onBlur={() => persist({ customSourceTag: customSourceTag || null })}
                    placeholder={tx.amount > 0
                      ? 'e.g. Bytes AI — Client Acme SaaS, invoice #1234'
                      : 'e.g. Anthropic API for Bytes AI production'}
                    style={fieldInStyle}
                  />
                </div>
              ) : null}
              <div style={{ gridColumn: 'span 2' }}>
                <FieldLabel>Notes</FieldLabel>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => persist({ notes: notes || null })}
                  placeholder="Anything worth remembering"
                  style={{ ...fieldInStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', minHeight: 60 }}
                />
              </div>
            </div>
          </SectionEm>
          ) : null}

          {/* Pointer back to the full drawer for advanced editing */}
          <div
            style={{
              marginTop: 32,
              padding: '14px 18px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.10)',
              borderRadius: 10,
              fontSize: 11.5,
              color: 'var(--ink-3)',
              lineHeight: 1.5,
            }}
          >
            <b style={{ color: 'var(--ink-2)' }}>Advanced editing</b> — recurrence per part, money flow chain,
            inter-entity owings, salary &amp; budget tagging, escalation, CPA sign-off all live in the
            quick-edit drawer. Open the row again from the list to use the full editor.
          </div>

          {viewerIsEditor ? (
            <>
              <IdentifyZone
                txId={tx.id}
                initialFlagged={!!tx.needsIdentification}
                initialNote={tx.identificationNote || ''}
              />
              <DangerZone txId={tx.id} />
            </>
          ) : null}
        </div>

        {/* ── RIGHT ASIDE ──────────────────────────────────────── */}
        <aside
          className="tx-detail-aside"
          style={{
            padding: '36px 32px 32px',
            background: 'color-mix(in oklab, var(--gold) 2%, var(--bg-1, #111114))',
          }}
        >
          <AsideEyebrow>Activity timeline</AsideEyebrow>
          <TimelineItem
            dotColor="var(--gold)"
            glow
            time="Now"
            title={fifoSource ? 'AI traced source' : 'Awaiting review'}
            meta={
              fifoSource
                ? `FIFO from ${fifoSource.date} ${fifoSource.merchant} · 100% match`
                : 'No funding source linked yet'
            }
          />
          <TimelineItem
            dotColor="var(--ink-3)"
            time={tx.postingDate}
            title="Transaction posted"
            meta={account ? `Cleared from Chase ····${account.id}` : 'Cleared from Chase'}
          />
          {tx.transactionDate && tx.transactionDate !== tx.postingDate ? (
            <TimelineItem
              dotColor="var(--ink-3)"
              time={tx.transactionDate}
              title="Charge initiated"
              meta="Authorized at merchant"
            />
          ) : null}

          <AsideEyebrow style={{ marginTop: 32 }}>Related</AsideEyebrow>
          {fifoSource ? (
            <TimelineItem
              dotColor="var(--income)"
              titleColor="var(--income)"
              title={`+ $${Math.abs(fifoSource.amount).toLocaleString()} · ${fifoSource.merchant}`}
              meta={`${fifoSource.date} · funding source for this transaction`}
            />
          ) : (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '14px 0' }}>
              No related transactions linked.
            </div>
          )}

          <AsideEyebrow style={{ marginTop: 32 }}>Audit flags</AsideEyebrow>
          <div
            style={{
              padding: '14px 16px',
              background: 'var(--bg-1, #111114)',
              border: `1px solid color-mix(in oklab, ${flag.color} 28%, rgba(255,255,255,0.055))`,
              borderRadius: 10,
              fontSize: 11.5,
              color: 'var(--ink-2)',
            }}
          >
            <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  width: 6, height: 6, borderRadius: 50, background: flag.color,
                  boxShadow: `0 0 6px ${flag.color}`,
                }}
              />
              <span
                style={{
                  color: flag.color, fontWeight: 600, fontSize: 10.5,
                  letterSpacing: '.12em', textTransform: 'uppercase',
                }}
              >
                Score {tx.auditScore || 0} · {flag.label}
              </span>
            </div>
            {auditFlagCopy(tx)}
          </div>

          {tx.needsEscalation ? (
            <div
              style={{
                marginTop: 14,
                padding: '14px 16px',
                background: 'rgba(251,191,36,0.06)',
                border: '1px solid rgba(251,191,36,0.30)',
                borderRadius: 10,
                fontSize: 11.5,
                color: 'var(--ink-2)',
              }}
            >
              <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
                <AlertTriangle size={11} style={{ color: 'var(--warn)' }} />
                <span style={{ color: 'var(--warn)', fontWeight: 600, fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase' }}>
                  Escalation
                </span>
              </div>
              Flagged for verification by{' '}
              <b style={{ color: 'var(--ink)' }}>{tx.escalationTo || 'unassigned'}</b>
              {tx.escalationNotes ? <> — {tx.escalationNotes}</> : null}
            </div>
          ) : null}
        </aside>
      </div>

      {/* Sticky footer */}
      <div
        className="sticky flex items-center tx-footbar"
        style={{
          bottom: 0,
          padding: '14px 36px',
          gap: 10,
          background: 'rgba(17,17,20,0.7)',
          backdropFilter: 'blur(18px)',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          zIndex: 5,
        }}
      >
        <div className="flex tx-kbd-hints" style={{ gap: 14, marginRight: 'auto', fontSize: 10.5, color: 'var(--ink-4, #44443f)' }}>
          <KbdHint k="← →" label="Navigate" />
          <KbdHint k="C" label="Confirm" />
          <KbdHint k="P" label="Personal" />
          <KbdHint k="R" label="Receipt" />
          <KbdHint k="⌘S" label="Save" />
        </div>
        {viewerIsEditor ? (
          <BackToTransactionsLink className="btn btn-ghost btn-sm">Cancel</BackToTransactionsLink>
        ) : (
          <Link href="/identify" className="btn btn-ghost btn-sm">Done — back to my queue</Link>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            persist({ auditStatus: 'CONFIRMED', reviewState: 'REVIEWED_APPROVED', reviewedAt: new Date().toISOString() });
            router.push('/transactions');
          }}
        >
          <Check size={11} /> Save &amp; next
        </button>
      </div>
    </>
  );
}

// ─────────────── Sub-components ───────────────

interface InflowSearchResult {
  id: string;
  postingDate: string;
  description: string;
  merchant: string | null;
  amount: number;
  accountId: string;
}

function AiSourceTraceCard({ tx, fifoSource, fifoSources = [], sourceIsOverride }: {
  tx: Transaction;
  fifoSource: FifoSource | null;
  /** All inflows the FIFO trace attributes to this expense — one row
   *  per source in consumption order. When empty we fall back to
   *  fifoSource alone (single-source view). */
  fifoSources?: FifoSource[];
  sourceIsOverride: boolean;
}) {
  const router = useRouter();
  const { saveStart, saveEnd, saveError } = useToast();
  const has = !!fifoSource;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InflowSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  async function runSearch() {
    setSearching(true);
    try {
      const r = await fetch(
        `/api/transactions/search?inflowOnly=1&limit=20&q=${encodeURIComponent(query)}`,
        { credentials: 'same-origin' }
      );
      const d = await r.json();
      setResults(d.transactions || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function pickSource(sourceTxId: string) {
    if (busy) return;
    setBusy(true);
    const toastId = saveStart();
    try {
      await saveTransaction(tx.id, { fundedByTransactionId: sourceTxId });
      saveEnd(toastId);
      setPickerOpen(false);
      setQuery('');
      setResults(null);
      router.refresh();
    } catch (e: any) {
      saveError(toastId, e?.message || 'Failed to set source');
    } finally {
      setBusy(false);
    }
  }

  async function retrace() {
    if (busy) return;
    setBusy(true);
    const toastId = saveStart();
    try {
      // Clear any manual override so the FIFO trace runs fresh on next render.
      // When there IS no override we still refresh — the FIFO queue can shift
      // if you added new transactions since this page loaded, so a re-fetch
      // is meaningful even without unlinking.
      if (sourceIsOverride) {
        await saveTransaction(tx.id, { fundedByTransactionId: null });
      }
      saveEnd(toastId);
      router.refresh();
    } catch (e: unknown) {
      saveError(toastId, e instanceof Error ? e.message : 'Retrace failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 0,
        padding: '18px 22px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, color-mix(in oklab, var(--gold) 10%, var(--bg-1, #111114)) 0%, color-mix(in oklab, var(--gold) 3%, var(--bg-1, #111114)) 100%)',
        border: '1px solid color-mix(in oklab, var(--gold) 26%, rgba(255,255,255,0.055))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute', width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,122,.12), transparent 70%)',
          right: -80, top: -80, pointerEvents: 'none',
        }}
      />
      <div className="flex items-center" style={{ gap: 11, marginBottom: 14, position: 'relative' }}>
        <div
          className="grid place-items-center"
          style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'color-mix(in oklab, var(--gold) 22%, var(--bg-2, #16161a))',
            border: '0.5px solid color-mix(in oklab, var(--gold) 40%, rgba(255,255,255,0.055))',
            color: 'var(--gold)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 0 14px -6px rgba(201,168,122,.4)',
          }}
        >
          <Sparkles size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-.005em' }}>
            Source of money ·{' '}
            <em style={{ fontFamily: 'var(--font-serif, "Instrument Serif", serif)', fontStyle: 'italic', color: 'var(--gold)' }}>
              {sourceIsOverride ? 'manual override' : 'AI-traced'}
            </em>
            {tx.isInternal ? (
              <span
                className="pill"
                style={{
                  marginLeft: 8, fontSize: 9.5, padding: '2px 8px', borderRadius: 999,
                  color: 'var(--gold)',
                  background: 'color-mix(in oklab, var(--gold) 10%, transparent)',
                  border: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)',
                  verticalAlign: 'middle',
                }}
              >
                INTERNAL ↔
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            {tx.isInternal ? (
              sourceIsOverride
                ? 'You picked the original source of this transfer · Retrace to re-run FIFO from scratch'
                : has
                  ? 'AI picked the FIFO source · override to pin a specific inflow this transfer came from'
                  : 'Internal transfer — pick the inflow this money originated from before hitting this account'
            ) : (
              sourceIsOverride
                ? 'You set this source manually · Retrace to switch back to the FIFO trace'
                : fifoSources.length > 1
                  ? `Funded from ${fifoSources.length} prior inflows · you can pin a single source to override`
                  : has
                    ? 'Funded 100% from a prior inflow · you can override'
                    : 'No prior inflow detected on this account yet'
            )}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={retrace} disabled={busy}>
          <RotateCcw size={11} /> Retrace
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setPickerOpen((v) => !v)}
          disabled={busy}
        >
          {pickerOpen ? 'Close' : 'Override'}
        </button>
      </div>

      {pickerOpen ? (
        <div
          className="card p-3 space-y-2"
          style={{ marginBottom: 14, background: 'var(--bg-2, #16161a)' }}
        >
          <div className="text-2xs text-ink-mute">
            Search a prior inflow to link as the funding source for this expense.
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              placeholder="search income (Spacetel, Stripe, investor name…)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
              className="flex-1 !text-sm"
            />
            <button type="button" className="btn btn-sm" onClick={runSearch} disabled={searching}>
              {searching ? '…' : 'Find'}
            </button>
          </div>
          {results !== null ? (
            results.length === 0 ? (
              <div className="text-2xs text-ink-mute italic">No matching inflows.</div>
            ) : (
              <div className="border border-line rounded-md max-h-56 overflow-y-auto divide-y divide-line/40">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pickSource(r.id)}
                    disabled={busy}
                    className="block w-full text-left px-3 py-2 hover:bg-bg-3 transition disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{r.merchant || r.description.slice(0, 50)}</span>
                      <span className="num text-income text-sm">{fmtMoney(r.amount)}</span>
                    </div>
                    <div className="text-2xs text-ink-mute mt-0.5">
                      {r.postingDate} · ····{r.accountId}
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : null}
        </div>
      ) : null}

      {/* Sources chain. When we have multiple FIFO sources, render each
          as a stacked inflow box with its attributed slice — showing the
          full picture that one expense may have drained several deposits.
          When only one source (or none), fall back to the single-row
          layout to keep the desktop UX intact. */}
      {(() => {
        const sources = fifoSources.length > 0 ? fifoSources : (fifoSource ? [fifoSource] : []);
        const total = Math.abs(tx.amount);
        const attributed = sources.reduce((s, x) => s + x.attributedAmount, 0);
        const uncovered = Math.max(0, total - attributed);

        if (sources.length === 0) {
          return (
            <div className="flex items-center">
              <FlowNode
                type="inflow"
                eyebrow="INFLOW · —"
                title="No prior inflow"
                meta="Run AI trace from Source of Money in the drawer"
              />
              <div style={{ padding: '0 10px', color: 'var(--ink-3)' }}>
                <ArrowRight size={20} strokeWidth={1.4} />
              </div>
              <FlowNode
                type="outflow"
                eyebrow="OUTFLOW · NOW"
                title={(tx.merchantName || tx.description.slice(0, 50)).toUpperCase()}
                meta={`−${fmtMoney(-total)} · 100% of expense`}
              />
            </div>
          );
        }

        if (sources.length === 1) {
          const s = sources[0];
          const pctOfExpense = total > 0 ? Math.min(100, (s.attributedAmount / total) * 100) : 0;
          return (
            <div className="flex items-center">
              <FlowNode
                type="inflow"
                eyebrow={`INFLOW · ${s.date}`}
                title={s.merchant.toUpperCase()}
                meta={`+${fmtMoney(s.attributedAmount)} of ${fmtMoney(s.amount)} · ····${s.accountId}`}
                owner={s.ownerLabel}
                href={`/transactions/${s.txId}`}
              />
              <div style={{ padding: '0 10px', color: 'var(--ink-3)' }}>
                <ArrowRight size={20} strokeWidth={1.4} />
              </div>
              <FlowNode
                type="outflow"
                eyebrow="OUTFLOW · NOW"
                title={(tx.merchantName || tx.description.slice(0, 50)).toUpperCase()}
                meta={`−${fmtMoney(-total)} · ${pctOfExpense.toFixed(0)}% covered`}
              />
            </div>
          );
        }

        // Multi-source view: vertical stack of inflow boxes on the left,
        // single outflow on the right. Each source shows its slice AND
        // what % of the total expense it covered.
        return (
          <div className="grid tx-source-multigrid" style={{ gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.14em', color: 'var(--income)', fontWeight: 600 }}>
                {sources.length} inflows funded this
              </div>
              {sources.map((s) => {
                const pct = total > 0 ? (s.attributedAmount / total) * 100 : 0;
                return (
                  <Link
                    key={s.txId}
                    href={`/transactions/${s.txId}`}
                    style={{
                      display: 'block',
                      padding: '10px 12px',
                      background: 'var(--bg-1, #111114)',
                      border: '1px solid color-mix(in oklab, var(--income) 22%, rgba(255,255,255,0.055))',
                      borderRadius: 8,
                      textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <div className="num" style={{ fontSize: 9.5, color: 'var(--income)', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase' }}>
                      {s.date} · ····{s.accountId}
                    </div>
                    <div className="truncate" style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 2 }}>
                      {s.merchant.toUpperCase()}
                    </div>
                    <div className="flex items-baseline" style={{ marginTop: 4, gap: 8 }}>
                      <span className="num" style={{ fontSize: 13, color: 'var(--income)', fontWeight: 500 }}>
                        {fmtMoney(s.attributedAmount)}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                        {pct.toFixed(0)}% of this expense · of {fmtMoney(s.amount)} inflow
                      </span>
                    </div>
                    {s.ownerLabel ? (
                      <div className="truncate" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4, paddingTop: 4, borderTop: '0.5px dashed rgba(255,255,255,0.08)' }}>
                        <span style={{ color: 'var(--ink-4, #44443f)' }}>Owner · </span>{s.ownerLabel}
                      </div>
                    ) : null}
                  </Link>
                );
              })}
              {uncovered > 0.01 ? (
                <div style={{ fontSize: 10.5, color: 'var(--warn, #d4b16f)', padding: '6px 10px', border: '0.5px dashed color-mix(in oklab, var(--warn, #d4b16f) 30%, transparent)', borderRadius: 6 }}>
                  {fmtMoney(uncovered)} uncovered — no prior inflow accounts for this slice
                </div>
              ) : null}
            </div>
            <div style={{ alignSelf: 'center', color: 'var(--ink-3)' }}>
              <ArrowRight size={20} strokeWidth={1.4} />
            </div>
            <div style={{ alignSelf: 'stretch', display: 'flex' }}>
              <FlowNode
                type="outflow"
                eyebrow="OUTFLOW · NOW"
                title={(tx.merchantName || tx.description.slice(0, 50)).toUpperCase()}
                meta={`−${fmtMoney(-total)} · ${sources.length}-source split`}
              />
            </div>
          </div>
        );
      })()}

      <div className="flex items-center" style={{ gap: 8, marginTop: 12, fontSize: 11, color: 'var(--ink-3)' }}>
        <Check size={11} style={{ color: 'var(--income)' }} />
        {has
          ? (fifoSources.length > 1
              ? `Funded across ${fifoSources.length} inflows · audit trail complete · CPA-ready`
              : 'Fully allocated · audit trail complete · CPA-ready')
          : 'No source linked — tag manually or run AI trace from the drawer'}
      </div>
    </div>
  );
}

function DownstreamUsageCard({ tx, downstream }: { tx: Transaction; downstream: DownstreamTrace }) {
  const total = Math.abs(tx.amount);
  const spent = downstream.totalSpent;
  const remaining = Math.max(0, downstream.remaining);
  const pct = Math.min(100, Math.max(0, downstream.pctSpent));
  return (
    <div
      style={{
        marginTop: 0,
        padding: '18px 22px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, color-mix(in oklab, var(--income) 8%, var(--bg-1, #111114)) 0%, color-mix(in oklab, var(--income) 3%, var(--bg-1, #111114)) 100%)',
        border: '1px solid color-mix(in oklab, var(--income) 24%, rgba(255,255,255,0.055))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="flex items-center" style={{ gap: 11, marginBottom: 12 }}>
        <div
          className="grid place-items-center"
          style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'color-mix(in oklab, var(--income) 22%, var(--bg-2, #16161a))',
            border: '0.5px solid color-mix(in oklab, var(--income) 40%, rgba(255,255,255,0.055))',
            color: 'var(--income)',
          }}
        >
          <Sparkles size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-.005em' }}>
            Where the money went ·{' '}
            <em style={{ fontFamily: 'var(--font-serif, "Instrument Serif", serif)', fontStyle: 'italic', color: 'var(--income)' }}>
              FIFO traced
            </em>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            {pct >= 99.5
              ? 'Fully allocated to downstream expenses'
              : `${pct.toFixed(0)}% spent · ${fmtMoney(remaining)} still available on this account from this inflow`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="num" style={{ fontSize: 17, fontWeight: 600, color: 'var(--income)' }}>{fmtMoney(spent)}</div>
          <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>used of <span className="num">{fmtMoney(total)}</span></div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 8, borderRadius: 999, overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)', marginBottom: 14,
        }}
      >
        <div
          style={{
            width: `${pct}%`, height: '100%',
            background: 'linear-gradient(90deg, color-mix(in oklab, var(--income) 75%, transparent), var(--income))',
            transition: 'width 200ms ease',
          }}
        />
      </div>

      {/* Downstream consumers — compact list */}
      {downstream.consumers.length > 0 ? (
        <div
          style={{
            borderTop: '0.5px solid rgba(255,255,255,0.06)',
            paddingTop: 10,
            marginTop: 2,
          }}
        >
          <div
            style={{
              fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.14em',
              color: 'var(--ink-4, #44443f)', marginBottom: 8,
            }}
          >
            Funded {downstream.consumers.length} {downstream.consumers.length === 1 ? 'expense' : 'expenses'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(() => {
              let running = total;
              return downstream.consumers.slice(0, 8).map((c) => {
                const pctOfInflow = total > 0 ? (c.amountFromThisInflow / total) * 100 : 0;
                running = Math.max(0, running - c.amountFromThisInflow);
                const [yy, mm, dd] = c.date.split('-');
                const monthShort = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(mm, 10)] || mm;
                return (
                  <Link
                    key={c.txId}
                    href={`/transactions/${c.txId}`}
                    className="group"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '11px 4px',
                      borderBottom: '0.5px solid rgba(255,255,255,0.045)',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    {/* Date chip on the left so two same-merchant rows are visually distinct. */}
                    <div
                      style={{
                        width: 46, textAlign: 'center', flexShrink: 0,
                        padding: '4px 0', borderRadius: 7,
                        background: 'color-mix(in oklab, var(--income) 8%, var(--bg-2, #16161a))',
                        border: '0.5px solid color-mix(in oklab, var(--income) 22%, rgba(255,255,255,0.05))',
                      }}
                    >
                      <div style={{ fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--income)', fontWeight: 600, lineHeight: 1.1 }}>
                        {monthShort}
                      </div>
                      <div className="num" style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.1, marginTop: 1 }}>
                        {dd}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: 13, color: 'var(--ink)' }}>
                        {c.merchant || c.description.slice(0, 50)}
                      </div>
                      <div className="num" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        Took {pctOfInflow.toFixed(1)}% · {fmtMoney(running)} left after
                      </div>
                    </div>

                    <div
                      style={{
                        width: 54, height: 3, borderRadius: 999,
                        background: 'rgba(255,255,255,0.05)',
                        overflow: 'hidden', flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, pctOfInflow)}%`, height: '100%',
                          background: 'var(--income)',
                        }}
                      />
                    </div>
                    <div className="num" style={{ fontSize: 12.5, color: 'var(--ink-2)', minWidth: 90, textAlign: 'right' }}>
                      {fmtMoney(-c.amountFromThisInflow)}
                    </div>
                    <ArrowRight size={13} strokeWidth={1.4} style={{ color: 'var(--ink-4, #44443f)', flexShrink: 0 }} />
                  </Link>
                );
              });
            })()}
          </div>
          {downstream.consumers.length > 8 ? (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8, paddingLeft: 18 }}>
              + {downstream.consumers.length - 8} more
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          No downstream expenses yet — this inflow is still fully available.
        </div>
      )}
    </div>
  );
}

function FlowNode({
  type, eyebrow, title, meta, owner, href,
}: {
  type: 'inflow' | 'outflow';
  eyebrow: string;
  title: string;
  meta: string;
  owner?: string | null;
  href?: string;
}) {
  const isIn = type === 'inflow';
  const inner = (
    <>
      <div
        style={{
          fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.14em',
          color: isIn ? 'var(--income)' : 'var(--gold)', fontWeight: 600,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }} className="truncate">
        {title}
      </div>
      <div className="num" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
        {meta}
      </div>
      {owner ? (
        <div
          className="truncate"
          style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 6, paddingTop: 6, borderTop: '0.5px dashed rgba(255,255,255,0.08)' }}
        >
          <span style={{ color: 'var(--ink-4, #44443f)' }}>Owner · </span>{owner}
        </div>
      ) : null}
    </>
  );
  const boxStyle: React.CSSProperties = {
    flex: 1,
    padding: '14px 16px',
    background: 'var(--bg-1, #111114)',
    border: `1px solid color-mix(in oklab, ${isIn ? 'var(--income)' : 'var(--gold)'} 30%, rgba(255,255,255,0.055))`,
    borderRadius: 10,
    minWidth: 0,
    display: 'block',
    textDecoration: 'none',
    color: 'inherit',
    cursor: href ? 'pointer' : 'default',
    transition: 'background 80ms ease',
  };
  if (href) {
    return (
      <Link href={href} style={boxStyle} className="hover:bg-bg-3">
        {inner}
      </Link>
    );
  }
  return <div style={boxStyle}>{inner}</div>;
}

function SectionEm({
  title, emFirst, sub, right, children,
}: {
  title: string;
  emFirst: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const rest = title.slice(emFirst.length);
  return (
    <div style={{ marginTop: 32 }}>
      <div
        className="flex items-baseline"
        style={{
          gap: 10,
          paddingBottom: 12,
          borderBottom: '1px solid rgba(255,255,255,0.055)',
          marginBottom: 18,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-.015em' }}>
          <em style={{ fontFamily: 'var(--font-serif, "Instrument Serif", serif)', fontStyle: 'italic', color: 'var(--gold)', fontWeight: 400 }}>
            {emFirst}
          </em>
          {rest}
        </span>
        {sub ? <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{sub}</span> : null}
        <span style={{ marginLeft: 'auto' }}>{right}</span>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <div
      style={{
        fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.14em',
        color: gold ? 'var(--gold)' : 'var(--ink-3)',
        fontWeight: 600, marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

const fieldInStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 12px',
  borderRadius: 7,
  background: 'var(--bg-2, #16161a)',
  border: '1px solid rgba(255,255,255,0.055)',
  color: 'var(--ink)',
  fontSize: 13,
  transition: 'border-color 120ms ease',
};

function pathBtnStyle(active: boolean, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', borderRadius: 9,
    background: active ? `color-mix(in oklab, ${color} 12%, var(--bg-2, #16161a))` : 'var(--bg-2, #16161a)',
    border: '1px solid ' + (active ? color : 'rgba(255,255,255,0.10)'),
    color: active ? color : 'var(--ink-2)',
    fontSize: 13, fontWeight: 500,
    textAlign: 'left', cursor: 'pointer', transition: 'all 120ms ease',
  };
}

interface CustomCategorySuggestion { name: string; description: string | null; useCount: number }

function CustomCategoryInputs({
  name, desc, onNameChange, onDescChange, onNameBlur, onDescBlur, tone, path,
}: {
  name: string;
  desc: string;
  onNameChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onNameBlur: () => void;
  onDescBlur: () => void;
  tone: string;
  /** Filters the preset catalog to only categories that belong to this
   *  path — 'BUSINESS' hides Personal buckets, 'PERSONAL' hides Business
   *  ones. Previously-used DB entries always show regardless. */
  path: 'BUSINESS' | 'PERSONAL';
}) {
  // Build the seed list filtered by path — a business row only sees
  // business presets, a personal row only sees personal ones.
  const scopedPresets = useMemo(
    () => CUSTOM_CATEGORY_PRESETS.filter((p) => p.path === path),
    [path],
  );

  const [suggestions, setSuggestions] = useState<CustomCategorySuggestion[]>(() =>
    scopedPresets.map((p) => ({ name: p.name, description: p.description, useCount: 0 })),
  );

  useEffect(() => {
    // Reset local state whenever the user flips between Business and
    // Personal paths so the dropdown reflects the new scope immediately.
    setSuggestions(scopedPresets.map((p) => ({ name: p.name, description: p.description, useCount: 0 })));
  }, [scopedPresets]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/transactions/custom-categories', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !Array.isArray(d?.suggestions)) return;
        const fromDb = d.suggestions as CustomCategorySuggestion[];
        const seen = new Set(fromDb.map((s) => s.name.trim().toLowerCase()));
        const presetsNotYetUsed = scopedPresets
          .filter((p) => !seen.has(p.name.trim().toLowerCase()))
          .map((p) => ({ name: p.name, description: p.description, useCount: 0 }));
        // DB entries carry the user's real usage — keep them visible
        // regardless of path so cross-scope custom names still appear
        // once they've been used.
        setSuggestions([...fromDb, ...presetsNotYetUsed]);
      })
      .catch(() => { /* keep the presets */ });
    return () => { cancelled = true; };
  }, [scopedPresets]);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 40);
    return suggestions.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 40);
  }, [suggestions, name]);

  function pick(s: CustomCategorySuggestion) {
    onNameChange(s.name);
    if (s.description && !desc.trim()) onDescChange(s.description);
    setOpen(false);
    // Persist both on pick — no need to blur first.
    onNameBlur();
    if (s.description && !desc.trim()) {
      // Slight tick so onDescChange state settles before onDescBlur fires.
      setTimeout(onDescBlur, 0);
    }
  }

  function handleNameChange(v: string) {
    onNameChange(v);
    if (!open) setOpen(true);
  }

  return (
    <div style={{
      marginTop: 14, padding: 12, borderRadius: 8,
      border: `0.5px dashed color-mix(in oklab, ${tone} 30%, rgba(255,255,255,0.08))`,
      background: `color-mix(in oklab, ${tone} 4%, transparent)`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 8 }}>
        <em style={{ fontStyle: 'italic', color: tone }}>Custom category</em>
        {' — '}
        <span style={{ color: 'var(--ink-3)' }}>
          use this when none of the presets fit. Type to filter or pick from the list.
        </span>
      </div>
      <div className="grid" style={{ gap: 8 }}>
        <div ref={wrapRef} style={{ position: 'relative' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={onNameBlur}
            placeholder="Type or pick a category…"
            maxLength={80}
            autoComplete="off"
            style={{ ...fieldInStyle }}
          />
          {open && filtered.length > 0 ? (
            <div
              style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                zIndex: 20,
                maxHeight: 260, overflowY: 'auto',
                background: 'var(--bg-2, #16161a)',
                border: `1px solid color-mix(in oklab, ${tone} 20%, rgba(255,255,255,0.08))`,
                borderRadius: 8,
                boxShadow: '0 12px 40px -12px rgba(0,0,0,0.6)',
                WebkitOverflowScrolling: 'touch',
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {filtered.map((s, idx) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => pick(s)}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: 8,
                    width: '100%',
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderTop: idx > 0 ? '0.5px solid rgba(255,255,255,0.04)' : 'none',
                    color: 'var(--ink)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 12.5,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `color-mix(in oklab, ${tone} 10%, transparent)`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </span>
                  {s.useCount > 0 ? (
                    <span className="num" style={{ fontSize: 10, color: tone, flexShrink: 0 }}>
                      {s.useCount}×
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <textarea
          rows={2}
          value={desc}
          onChange={(e) => onDescChange(e.target.value)}
          onBlur={onDescBlur}
          placeholder="Description — what this category covers, when to use it"
          maxLength={500}
          style={{
            ...fieldInStyle,
            height: 'auto', padding: '10px 12px',
            resize: 'vertical', minHeight: 54,
          }}
        />
      </div>
    </div>
  );
}

function CategoryChip({
  active, color, onClick, children,
}: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '7px 10px', borderRadius: 6, textAlign: 'left',
        background: active ? `color-mix(in oklab, ${color} 12%, var(--bg-2, #16161a))` : 'var(--bg-2, #16161a)',
        border: '1px solid ' + (active ? color : 'rgba(255,255,255,0.055)'),
        color: active ? color : 'var(--ink-2)',
        fontSize: 11.5, fontWeight: active ? 500 : 400,
        cursor: 'pointer', transition: 'all 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

function FlagPill({ flag, score }: { flag: FlagInfo; score: number }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 5,
        padding: '3px 10px', borderRadius: 999,
        background: `color-mix(in oklab, ${flag.color} 14%, transparent)`,
        color: flag.color, fontSize: 10.5, fontWeight: 500,
        letterSpacing: '.02em',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 50, background: 'currentColor' }} />
      {flag.label}
      <span style={{ opacity: 0.6, marginLeft: 2 }}>·{score}</span>
    </span>
  );
}

function AsideEyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '.16em',
        color: 'var(--gold)', fontWeight: 500, marginBottom: 14, ...style,
      }}
    >
      {children}
    </div>
  );
}

function TimelineItem({
  dotColor, glow, time, title, meta, titleColor,
}: {
  dotColor: string;
  glow?: boolean;
  time?: string;
  title: string;
  meta?: string;
  titleColor?: string;
}) {
  return (
    <div className="flex" style={{ gap: 14, padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
      <span
        style={{
          width: 7, height: 7, borderRadius: 50, marginTop: 6, flex: '0 0 7px',
          background: dotColor,
          boxShadow: glow ? `0 0 6px ${dotColor}` : 'none',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {time ? (
          <div className="num" style={{ fontSize: 10, color: 'var(--ink-4, #44443f)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
            {time}
          </div>
        ) : null}
        <div style={{ fontSize: 12.5, color: titleColor || 'var(--ink)', marginTop: 3, fontWeight: 500 }}>
          {title}
        </div>
        {meta ? <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 3 }}>{meta}</div> : null}
      </div>
    </div>
  );
}

function DatesSection({
  tx, bookingDateMode, taggedDate, onModeChange, onTaggedDateChange,
}: {
  tx: Transaction;
  bookingDateMode: 'DAY' | 'MONTH';
  taggedDate: string;
  onModeChange: (mode: 'DAY' | 'MONTH') => void;
  onTaggedDateChange: (v: string) => void;
}) {
  const charge = tx.transactionDate;
  const posted = tx.postingDate;
  const isMonth = bookingDateMode === 'MONTH';
  const monthValue = taggedDate ? taggedDate.slice(0, 7) : '';

  return (
    <div style={{ marginTop: 24 }}>
      <div
        className="grid tx-dates-3col"
        style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}
      >
        {/* Charge date — from transaction description / source */}
        <div>
          <DateFieldLabel>Charge date</DateFieldLabel>
          <div style={readOnlyDateStyle}>{charge ? formatDate(charge) : '—'}</div>
          <div style={hintStyle}>From transaction description</div>
        </div>

        {/* Posted date — from Chase CSV */}
        <div>
          <DateFieldLabel>Posted date</DateFieldLabel>
          <div style={readOnlyDateStyle}>{formatDate(posted)}</div>
          <div style={hintStyle}>From bank · read-only</div>
        </div>

        {/* Booked date — gold accent, editable, Day/Month mode toggle */}
        <div>
          <DateFieldLabel gold>
            Booked date{' '}
            <span style={{ color: 'var(--gold)' }}>✏</span>
          </DateFieldLabel>
          {isMonth ? (
            <input
              type="month"
              value={monthValue}
              onChange={(e) => {
                const v = e.target.value ? `${e.target.value}-01` : '';
                onTaggedDateChange(v);
              }}
              className="num"
              style={{
                width: '100%',
                height: 36,
                padding: '0 12px',
                borderRadius: 7,
                background: 'var(--bg-2, #16161a)',
                border: '0.5px solid rgba(201,168,122,0.5)',
                boxShadow: '0 0 0 2px rgba(201,168,122,0.12)',
                color: 'var(--ink)',
                fontSize: 13,
                fontWeight: 500,
              }}
            />
          ) : (
            <input
              type="date"
              value={taggedDate || ''}
              onChange={(e) => onTaggedDateChange(e.target.value)}
              className="num"
              style={{
                width: '100%',
                height: 36,
                padding: '0 12px',
                borderRadius: 7,
                background: 'var(--bg-2, #16161a)',
                border: '0.5px solid rgba(201,168,122,0.5)',
                boxShadow: '0 0 0 2px rgba(201,168,122,0.12)',
                color: 'var(--ink)',
                fontSize: 13,
                fontWeight: 500,
              }}
            />
          )}
          <div className="flex" style={{ marginTop: 6, gap: 4 }}>
            <button
              type="button"
              onClick={() => onModeChange('DAY')}
              className="btn btn-sm"
              style={{
                flex: 1,
                justifyContent: 'center',
                background: !isMonth ? 'rgba(201,168,122,0.16)' : 'var(--bg-2, #16161a)',
                borderColor: !isMonth ? 'rgba(201,168,122,0.4)' : 'rgba(255,255,255,0.055)',
                color: !isMonth ? 'var(--gold)' : 'var(--ink-3)',
              }}
            >
              Specific day
              {!isMonth ? <Check size={10} style={{ marginLeft: 4 }} /> : null}
            </button>
            <button
              type="button"
              onClick={() => onModeChange('MONTH')}
              className="btn btn-sm"
              style={{
                flex: 1,
                justifyContent: 'center',
                background: isMonth ? 'rgba(201,168,122,0.16)' : 'var(--bg-2, #16161a)',
                borderColor: isMonth ? 'rgba(201,168,122,0.4)' : 'rgba(255,255,255,0.055)',
                color: isMonth ? 'var(--gold)' : 'var(--ink-3)',
              }}
            >
              Month only
              {isMonth ? <Check size={10} style={{ marginLeft: 4 }} /> : null}
            </button>
          </div>
          <div style={hintStyle}>
            {isMonth
              ? 'Books to the 1st · useful for subscriptions'
              : 'Books to the specific day'}
          </div>
        </div>
      </div>
    </div>
  );
}

function DateFieldLabel({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <div
      style={{
        fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.14em',
        color: gold ? 'var(--gold)' : 'var(--ink-3)',
        fontWeight: 600, marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

const readOnlyDateStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 7,
  background: 'var(--bg-2, #16161a)',
  border: '0.5px solid rgba(255,255,255,0.055)',
  color: 'var(--ink-2)',
  fontSize: 13,
  fontFamily: 'var(--font-mono, "Geist Mono", monospace)',
  height: 36,
  display: 'flex',
  alignItems: 'center',
};

const hintStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: 'var(--ink-3)',
  marginTop: 5,
};

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    // If month-only YYYY-MM, show as 'May 2026'
    if (s.length === 7) {
      return new Date(s + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' });
    }
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return s;
  }
}

function KbdHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center" style={{ gap: 5 }}>
      <span
        className="num"
        style={{
          fontSize: 9.5, padding: '1px 5px',
          border: '1px solid rgba(255,255,255,0.055)', borderRadius: 3,
          background: 'var(--bg-3, #1c1c21)', color: 'var(--ink-3)',
        }}
      >
        {k}
      </span>
      {label}
    </span>
  );
}

function auditFlagCopy(tx: Transaction): React.ReactNode {
  const isIntlWire = /WIRE|FEDWIRE|INTERNATIONAL|ABU DHABI|SWIFT/i.test(tx.description);
  const isContractor = tx.subCategory2?.toLowerCase().includes('contractor');
  if ((tx.auditScore || 0) >= 80 || isIntlWire) {
    return (
      <>
        International wire detected.{' '}
        <b style={{ color: 'var(--ink)' }}>FBAR / FinCEN</b> review recommended for transactions over $10K.
      </>
    );
  }
  if (isContractor) {
    return (
      <>
        Recurring contractor pattern.{' '}
        <b style={{ color: 'var(--ink)' }}>1099-NEC</b> threshold approaching — confirm contractor entity assignment.
      </>
    );
  }
  return (
    <>
      Review pending — confirm entity, category, and source of money before CPA sign-off.
    </>
  );
}

function IdentifyZone({ txId, initialFlagged, initialNote }: {
  txId: string;
  initialFlagged: boolean;
  initialNote: string;
}) {
  const [flagged, setFlagged] = useState(initialFlagged);
  const [note, setNote] = useState(initialNote);
  const [expanded, setExpanded] = useState(initialFlagged);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function toggle(next: boolean) {
    setMsg(null);
    startTransition(async () => {
      try {
        await flagForIdentificationAction(txId, next, next ? note : null);
        setFlagged(next);
        setMsg(next ? 'Added to Identify queue' : 'Removed from Identify queue');
        setTimeout(() => setMsg(null), 1600);
      } catch (e) {
        setMsg(`Failed: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    });
  }

  function saveNote() {
    startTransition(async () => {
      try {
        await flagForIdentificationAction(txId, true, note);
        setMsg('Note saved');
        setTimeout(() => setMsg(null), 1400);
      } catch (e) {
        setMsg(`Failed: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    });
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: '14px 16px',
        borderRadius: 10,
        border: '0.5px dashed color-mix(in oklab, var(--gold) 30%, rgba(255,255,255,0.08))',
        background: flagged
          ? 'color-mix(in oklab, var(--gold) 5%, transparent)'
          : 'transparent',
      }}
    >
      <div className="flex items-center" style={{ gap: 10 }}>
        <UserSearch size={14} style={{ color: 'var(--gold)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>
            {flagged ? 'Flagged — cofounders can claim this on /identify' : 'Not sure whose charge this is?'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            {flagged
              ? "It's in the /identify queue. Anyone on the team can claim it."
              : 'Send it to the /identify queue so cofounders can look at it and claim their own.'}
          </div>
        </div>
        {flagged ? (
          <button
            type="button"
            onClick={() => toggle(false)}
            disabled={isPending}
            className="btn"
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            Remove flag
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setExpanded(true); toggle(true); }}
            disabled={isPending}
            className="btn"
            style={{ fontSize: 12, padding: '6px 12px', color: 'var(--gold)', borderColor: 'color-mix(in oklab, var(--gold) 30%, rgba(255,255,255,0.08))' }}
          >
            Send to /identify
          </button>
        )}
      </div>

      {flagged && expanded ? (
        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            placeholder="Optional note — e.g. 'anyone recognize this?', 'LA trip?', 'Uber on 5/12'"
            style={{
              width: '100%',
              padding: '7px 10px',
              background: 'var(--bg-1, #111114)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--ink)',
              outline: 'none',
            }}
          />
        </div>
      ) : null}

      {msg ? (
        <div style={{ fontSize: 10.5, color: msg.startsWith('Failed') ? 'var(--danger, #ff7676)' : 'var(--income)', marginTop: 8 }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}

function DangerZone({ txId }: { txId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function doDelete() {
    setErr(null);
    startTransition(async () => {
      try {
        await deleteTransactionAction(txId);
        // redirect happens server-side
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to delete');
      }
    });
  }

  return (
    <div
      style={{
        marginTop: 32,
        padding: '14px 16px',
        borderRadius: 10,
        border: '0.5px dashed color-mix(in oklab, var(--danger, #ff7676) 35%, rgba(255,255,255,0.08))',
        background: 'color-mix(in oklab, var(--danger, #ff7676) 3%, transparent)',
      }}
    >
      <div className="flex items-center" style={{ gap: 10 }}>
        <Trash2 size={14} style={{ color: 'var(--danger, #ff7676)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>Delete this transaction</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            Removes the row, its splits, and unlinks any expense that referenced it as a funding source. Cannot be undone.
          </div>
        </div>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn"
            style={{ fontSize: 12, padding: '6px 12px', color: 'var(--danger, #ff7676)', borderColor: 'color-mix(in oklab, var(--danger, #ff7676) 25%, rgba(255,255,255,0.08))' }}
          >
            Delete
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn"
              style={{ fontSize: 12, padding: '6px 10px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doDelete}
              disabled={isPending}
              className="btn"
              style={{
                fontSize: 12, padding: '6px 12px',
                background: 'var(--danger, #ff7676)',
                color: '#fff', borderColor: 'transparent',
                opacity: isPending ? 0.5 : 1,
              }}
            >
              {isPending ? 'Deleting…' : 'Confirm delete'}
            </button>
          </div>
        )}
      </div>
      {err ? (
        <div style={{ fontSize: 11, color: 'var(--danger, #ff7676)', marginTop: 8 }}>{err}</div>
      ) : null}
    </div>
  );
}
