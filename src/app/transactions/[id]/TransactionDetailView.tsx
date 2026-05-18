'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, CreditCard, Sparkles, RotateCcw,
  Split as SplitIcon, User, Building2, AlertTriangle,
} from 'lucide-react';
import type { Transaction, EntityType } from '@/types';
import { ENTITY_LABELS, ENTITY_COLORS, BUSINESS_ENTITIES } from '@/constants/accounts';
import {
  PERSONAL_CATEGORIES, BUSINESS_CATEGORIES,
  PERSONAL_INCOME_CATEGORIES, BUSINESS_INCOME_CATEGORIES,
} from '@/constants/categories';
import { saveTransaction } from '../actions';
import { useToast } from '@/components/Toast';
import BankChip from '@/components/BankChip';

interface AccountLite { id: string; label: string; entity: EntityType; last4: string }
interface FifoSource { merchant: string; amount: number; accountId: string; date: string; isInternal: boolean; attributedAmount: number }

interface FlagInfo { level: 'critical' | 'high' | 'medium' | 'low'; label: string; color: string }
function flagFor(score: number | null | undefined): FlagInfo {
  const s = score || 0;
  if (s >= 80) return { level: 'critical', label: 'Critical', color: '#d18876' };
  if (s >= 60) return { level: 'high', label: 'High', color: '#e89859' };
  if (s >= 30) return { level: 'medium', label: 'Medium', color: '#d4b16f' };
  return { level: 'low', label: 'Low', color: '#6f6e68' };
}

export default function TransactionDetailView({
  tx, account, fifoSource,
}: {
  tx: Transaction;
  account: AccountLite | null;
  fifoSource: FifoSource | null;
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
  const [notes, setNotes] = useState<string>(tx.notes || '');
  const [isSplit, setIsSplit] = useState(false);

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
        className="sticky top-0 z-30 flex items-center"
        style={{
          padding: '14px 36px',
          gap: 10,
          background: 'var(--bg-0, #0a0a0c)',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        <Link href="/transactions" className="btn btn-ghost btn-sm">
          <ArrowLeft size={12} /> Back to transactions
        </Link>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-sm" disabled>
          <ArrowLeft size={11} /> Prev
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled>
          Next <ArrowRight size={11} />
        </button>
        <span style={{ color: 'var(--ink-4, #44443f)' }}>·</span>
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

      {/* Two-column body */}
      <div
        className="grid"
        style={{ gridTemplateColumns: '1fr 380px', borderBottom: '1px solid rgba(255,255,255,0.055)' }}
      >
        {/* ── LEFT MAIN COLUMN ─────────────────────────────────────── */}
        <div
          style={{
            padding: '36px 36px 32px',
            borderRight: '1px solid rgba(255,255,255,0.055)',
            position: 'relative',
          }}
        >
          {/* Transaction header */}
          <div className="flex items-start" style={{ gap: 18, marginBottom: 28 }}>
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
              <div className="flex flex-wrap items-center" style={{ marginTop: 18, gap: 8 }}>
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
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                className="num"
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

          {/* AI Source trace card — only for expenses */}
          {isExpense ? (
            <AiSourceTraceCard tx={tx} fifoSource={fifoSource} />
          ) : null}

          {/* Split decision */}
          <SectionEm title="Split transaction" emFirst="Split" sub="Decide first — then categorize each part">
            <div className="grid grid-cols-2" style={{ gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsSplit(false)}
                style={pathBtnStyle(!isSplit, 'var(--ink-3)')}
              >
                <Check size={13} style={{ opacity: !isSplit ? 1 : 0.4 }} />
                One charge · one categorization
                <span style={{ marginLeft: 'auto', fontSize: 11 }}>●</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSplit(true)}
                style={pathBtnStyle(isSplit, 'var(--purple)')}
              >
                <SplitIcon size={13} />
                Split this charge
              </button>
            </div>
            {isSplit ? (
              <div
                style={{
                  marginTop: 14,
                  padding: '14px 18px',
                  background: 'rgba(167,139,250,0.04)',
                  border: '1px dashed rgba(167,139,250,0.30)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'var(--ink-2)',
                  lineHeight: 1.55,
                }}
              >
                Split editing lives in the legacy drawer for now — open the row from the list and pick
                &ldquo;Yes — split this charge&rdquo; for the full per-part categorizer (entity, source of money,
                recurrence, money flow, notes, all per split).
              </div>
            ) : null}
          </SectionEm>

          {/* Books to */}
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
                </div>

                {businessCat1Key && businessCats[businessCat1Key] ? (
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
                    <input
                      type="text"
                      value={individual}
                      onChange={(e) => setIndividual(e.target.value)}
                      onBlur={() => persist({ individual: individual || null })}
                      placeholder="Person on your team"
                      style={fieldInStyle}
                    />
                  </div>
                  <div>
                    <FieldLabel>Counterparty</FieldLabel>
                    <input
                      type="text"
                      placeholder="Who got paid"
                      style={fieldInStyle}
                    />
                  </div>
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
                </div>

                {personalCat1Key && personalCats[personalCat1Key] ? (
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

          {/* Notes & documentation */}
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
                <input
                  type="text"
                  value={individual}
                  onChange={(e) => setIndividual(e.target.value)}
                  onBlur={() => persist({ individual: individual || null })}
                  placeholder="Person tied to this charge"
                  style={fieldInStyle}
                />
              </div>
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
        </div>

        {/* ── RIGHT ASIDE ──────────────────────────────────────── */}
        <aside
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
        className="sticky flex items-center"
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
        <div className="flex" style={{ gap: 14, marginRight: 'auto', fontSize: 10.5, color: 'var(--ink-4, #44443f)' }}>
          <KbdHint k="← →" label="Navigate" />
          <KbdHint k="C" label="Confirm" />
          <KbdHint k="P" label="Personal" />
          <KbdHint k="R" label="Receipt" />
          <KbdHint k="⌘S" label="Save" />
        </div>
        <Link href="/transactions" className="btn btn-ghost btn-sm">Cancel</Link>
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

function AiSourceTraceCard({ tx, fifoSource }: { tx: Transaction; fifoSource: FifoSource | null }) {
  const has = !!fifoSource;
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
              AI-traced
            </em>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            {has ? 'Funded 100% from a prior inflow · you can override' : 'No prior inflow detected on this account yet'}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm">
          <RotateCcw size={11} /> Retrace
        </button>
        <button type="button" className="btn btn-ghost btn-sm">Override</button>
      </div>

      <div className="flex items-center">
        <FlowNode
          type="inflow"
          eyebrow={has ? `INFLOW · ${fifoSource!.date}` : 'INFLOW · —'}
          title={has ? fifoSource!.merchant.toUpperCase() : 'No prior inflow'}
          meta={has ? `Wire +$${Math.abs(fifoSource!.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} · ····${fifoSource!.accountId}` : 'Run AI trace from Source of Money in the drawer'}
        />
        <div style={{ padding: '0 10px', color: 'var(--ink-3)' }}>
          <ArrowRight size={20} strokeWidth={1.4} />
        </div>
        <FlowNode
          type="outflow"
          eyebrow="OUTFLOW · NOW"
          title={(tx.merchantName || tx.description.slice(0, 50)).toUpperCase()}
          meta={`−$${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} · 100% of expense`}
        />
      </div>

      <div className="flex items-center" style={{ gap: 8, marginTop: 12, fontSize: 11, color: 'var(--ink-3)' }}>
        <Check size={11} style={{ color: 'var(--income)' }} />
        {has ? 'Fully allocated · audit trail complete · CPA-ready' : 'No source linked — tag manually or run AI trace from the drawer'}
      </div>
    </div>
  );
}

function FlowNode({
  type, eyebrow, title, meta,
}: {
  type: 'inflow' | 'outflow';
  eyebrow: string;
  title: string;
  meta: string;
}) {
  const isIn = type === 'inflow';
  return (
    <div
      style={{
        flex: 1,
        padding: '14px 16px',
        background: 'var(--bg-1, #111114)',
        border: `1px solid color-mix(in oklab, ${isIn ? 'var(--income)' : 'var(--gold)'} 30%, rgba(255,255,255,0.055))`,
        borderRadius: 10,
        minWidth: 0,
      }}
    >
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
    </div>
  );
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
