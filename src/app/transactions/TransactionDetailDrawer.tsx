'use client';

import { useEffect, useState, useTransition } from 'react';
import { X, Check } from 'lucide-react';
import type { Transaction, EntityType, AuditStatus } from '@/types';
import { ACCOUNTS, ENTITY_LABELS, ENTITY_COLORS, BUSINESS_ENTITIES, getAccount } from '@/constants/accounts';
import { fmtMoney, fmtDate } from '@/lib/format';
import { saveTransaction } from './actions';
import { useToast } from '@/components/Toast';
import SplitEditor from '../audit/SplitEditor';
import SourceTraceContent from './SourceTraceContent';
import DownstreamTraceContent from './DownstreamTraceContent';
import SameDayPanel from './SameDayPanel';
import Portal from '@/components/Portal';
import { ArrowDownToLine } from 'lucide-react';
import OptionSelect from '@/components/OptionSelect';

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
  const [fundingCommitmentId, setFundingCommitmentId] = useState(tx.fundingCommitmentId || '');
  const [isSalary, setIsSalary] = useState(tx.isSalary);
  const [salaryEntity, setSalaryEntity] = useState(tx.salaryEntity || '');
  const [salaryPersonId, setSalaryPersonId] = useState(tx.salaryPersonId || '');
  const [passthroughEntity, setPassthroughEntity] = useState(tx.passthroughEntity || '');
  const [passthroughPurpose, setPassthroughPurpose] = useState(tx.passthroughPurpose || '');
  const [passthroughPersonId, setPassthroughPersonId] = useState(tx.passthroughPersonId || '');
  const [passthroughNotes, setPassthroughNotes] = useState(tx.passthroughNotes || '');
  const [budgets, setBudgets] = useState<{ id: string; name: string; kind: string; entity: string | null }[] | null>(null);
  const [commitments, setCommitments] = useState<{ id: string; entity: string; personName: string | null }[] | null>(null);
  const [optionLists, setOptionLists] = useState<Record<string, string[]>>({
    individual: [], sub_category_1: [], sub_category_2: [], business_purpose: [], source_of_money: [], need_to_get_from: [],
  });
  // sub_category_2 options grouped by parent (sub_category_1 value). Used to scope the Sub Category 2 dropdown.
  const [subCat2ByParent, setSubCat2ByParent] = useState<Map<string, string[]>>(new Map());
  const [subCat2NoParent, setSubCat2NoParent] = useState<string[]>([]);
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
    fetch('/api/commitments', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCommitments(d.commitments || []); })
      .catch(() => { if (!cancelled) setCommitments([]); });
    fetch('/api/options', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const grouped = d.options || {};
        const next: Record<string, string[]> = {};
        for (const k of ['individual', 'sub_category_1', 'sub_category_2', 'business_purpose', 'source_of_money', 'need_to_get_from']) {
          next[k] = (grouped[k] || []).map((o: any) => o.value);
        }
        setOptionLists(next);
        // Build sub_category_2 buckets keyed by parent
        const byParent = new Map<string, string[]>();
        const noParent: string[] = [];
        for (const o of (grouped.sub_category_2 || []) as Array<{ value: string; parentValue: string | null }>) {
          if (o.parentValue) {
            const list = byParent.get(o.parentValue) || [];
            list.push(o.value);
            byParent.set(o.parentValue, list);
          } else {
            noParent.push(o.value);
          }
        }
        setSubCat2ByParent(byParent);
        setSubCat2NoParent(noParent);
      })
      .catch(() => { /* leave empty */ });
    return () => { cancelled = true; };
  }, []);

  function addToList(field: string, value: string) {
    setOptionLists((prev) => prev[field]?.includes(value) ? prev : { ...prev, [field]: [...(prev[field] || []), value] });
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
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md animate-fade-in" onClick={onClose}>
        <div
          className="absolute top-0 right-0 bottom-0 w-[min(680px,100vw)] bg-bg-1 border-l border-line-strong flex flex-col shadow-elev-3 animate-slide-in-right"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.stopPropagation()}
        >
          {/* Header (fixed at top) */}
          <div className="shrink-0 surface-glass border-b border-line px-5 py-3.5 flex items-center justify-between">
            <div className="text-sm font-semibold tracking-tight">Transaction details</div>
            <button
              onClick={onClose}
              className="text-ink-mute hover:text-ink p-1.5 rounded-md hover:bg-bg-2 transition"
            ><X size={16} /></button>
          </div>

          {/* Body (scrollable, fills remaining space) */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-bg-0/40">
            {/* Section 1 — Summary */}
            <div className="card p-5 space-y-3" style={{ borderColor: `${entityColor}40` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-lg tracking-tight">{tx.merchantName || tx.description.slice(0, 80)}</div>
                  <div className="text-xs text-ink-mute mt-1 break-words">{tx.description}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`num-display text-3xl font-bold ${tx.amount >= 0 ? 'text-income' : 'text-expense'}`}>
                    {fmtMoney(tx.amount)}
                  </div>
                  {tx.balance != null ? (
                    <div className="num-display text-2xs text-ink-mute mt-0.5">balance after: {fmtMoney(tx.balance)}</div>
                  ) : null}
                </div>
              </div>
              <div className="text-2xs text-ink-dim flex flex-wrap gap-x-3 gap-y-1 pt-3 border-t border-line">
                {tx.transactionDate && tx.transactionDate !== tx.postingDate ? (
                  <span title="Extracted from description — when the charge/transfer actually happened.">
                    💳 Transaction: <span className="mono">{fmtDate(tx.transactionDate)}</span>
                  </span>
                ) : null}
                <span title="From Chase — when the bank processed this transaction. Cannot be changed.">
                  🏦 Posted: <span className="mono">{fmtDate(tx.postingDate)}</span>
                </span>
                <span>Paid from <span className="mono">···{tx.accountId}</span>{acct ? ` (${acct.label})` : ''}</span>
                <span>Posted as {tx.category.replace(/^(EXPENSE_|INCOME_)/, '').replace(/_/g, ' ').toLowerCase()}</span>
              </div>
            </div>

            {/* Money flow chain — visual when salary and/or passthrough is set */}
            {(isSalary || passthroughEntity) ? (
              <MoneyFlowChain
                payingEntity={(tx.confirmedEntity || tx.entityTag) as keyof typeof ENTITY_LABELS}
                isSalary={isSalary}
                salaryRecipientName={salaryPersonId ? (people || []).find((p) => p.id === salaryPersonId)?.name || null : null}
                salaryEntityLabel={salaryEntity ? ENTITY_LABELS[salaryEntity as keyof typeof ENTITY_LABELS] : null}
                passthroughEntityLabel={
                  passthroughEntity && passthroughEntity !== 'PENDING'
                    ? ENTITY_LABELS[passthroughEntity as keyof typeof ENTITY_LABELS] || passthroughEntity
                    : null
                }
                passthroughPurpose={passthroughPurpose}
                passthroughRecipientName={passthroughPersonId ? (people || []).find((p) => p.id === passthroughPersonId)?.name || null : null}
              />
            ) : null}

            {/* Section 2 — Source of money (expenses only) */}
            {tx.amount < 0 ? (
              <SectionCard
                title="Source of money"
                subtitle="FIFO trace of which prior inflow funded this expense"
                accent="income"
              >
                <SourceTraceContent txId={tx.id} compact />
              </SectionCard>
            ) : null}

            {/* Section 2b — What this money funded (inflows only, downstream trace) */}
            {tx.amount > 0 ? (
              <SectionCard
                title="What this money funded"
                subtitle="FIFO downstream trace — every expense that drew from this inflow"
                accent="warn"
              >
                <DownstreamTraceContent txId={tx.id} />
              </SectionCard>
            ) : null}

            {/* Section 3 — Review status */}
            <SectionCard title="Review status" subtitle="Status, CPA sign-off, and the booking date for accounting">
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
                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition ${
                      cpaReviewed
                        ? 'bg-income/15 border-income/40 text-income'
                        : 'bg-bg-2 border-line text-ink-dim hover:text-ink'
                    }`}
                  >
                    {cpaReviewed ? <><Check size={14} /> Yes — reviewed</> : 'No — not reviewed'}
                  </button>
                </Field>
                <Field label="Booking date" hint="when this should be booked for accounting">
                  <input
                    type="date"
                    value={taggedDate}
                    onChange={(e) => setTaggedDate(e.target.value)}
                    onBlur={() => persist({ taggedDate: taggedDate || null })}
                    className="w-full"
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Section 4 — Categorization */}
            <SectionCard title="Categorization" subtitle="Where it books, who it's about, and how it's classified">
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
                  label={tx.amount > 0 ? 'Source person (income)' : 'Counterparty person'}
                  hint={tx.amount > 0 ? 'who this money came FROM' : 'who this money went TO, if applicable'}
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
                    <div className="text-2xs text-ink-mute mt-1">No people yet — add them on the <a href="/team" className="text-entity-bytes hover:underline">Team page</a>.</div>
                  ) : null}
                </Field>
                <Field label="Individual" hint="who is this about">
                  <OptionSelect
                    field="individual"
                    value={individual}
                    options={optionLists.individual || []}
                    builtInOptions={{ label: 'People on the team', values: (people || []).map((p) => p.name) }}
                    onChange={(v) => { setIndividual(v); persist({ individual: v || null }); }}
                    onOptionAdded={(v) => addToList('individual', v)}
                    placeholder="— pick a person / vendor —"
                  />
                </Field>
                <Field label="Sub category 1" hint="bucket — pick first">
                  <OptionSelect
                    field="sub_category_1"
                    value={sub1}
                    options={optionLists.sub_category_1 || []}
                    onChange={(v) => {
                      setSub1(v);
                      if (v && sub2) {
                        const validChildren = subCat2ByParent.get(v) || [];
                        if (!validChildren.includes(sub2)) {
                          setSub2('');
                          persist({ subCategory1: v || null, subCategory2: null });
                          return;
                        }
                      }
                      persist({ subCategory1: v || null });
                    }}
                    onOptionAdded={(v) => addToList('sub_category_1', v)}
                  />
                </Field>
                <Field label="Sub category 2" hint={sub1 ? `filtered to ${sub1}` : undefined}>
                  <OptionSelect
                    field="sub_category_2"
                    value={sub2}
                    options={sub1 ? (subCat2ByParent.get(sub1) || []) : subCat2NoParent}
                    newOptionParent={sub1 || null}
                    secondaryGroups={
                      sub1
                        ? Array.from(subCat2ByParent.entries())
                            .filter(([parent]) => parent !== sub1)
                            .map(([parent, values]) => ({ label: parent, values }))
                        : undefined
                    }
                    onChange={(v) => { setSub2(v); persist({ subCategory2: v || null }); }}
                    onOptionAdded={(v) => {
                      addToList('sub_category_2', v);
                      if (sub1) {
                        setSubCat2ByParent((prev) => {
                          const next = new Map(prev);
                          next.set(sub1, [...(next.get(sub1) || []), v]);
                          return next;
                        });
                      } else {
                        setSubCat2NoParent((prev) => prev.includes(v) ? prev : [...prev, v]);
                      }
                    }}
                  />
                </Field>
              </div>
            </SectionCard>

            {/* Section 5 — Money flow */}
            <SectionCard
              title={tx.amount > 0 ? 'Inflow source' : 'Money flow'}
              subtitle={tx.amount > 0 ? 'Which business + account sent the money' : 'Which pool paid for this and where funds need to come from'}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <Field
                      label="Investor contribution"
                      className="md:col-span-2"
                      hint={commitments && commitments.length === 0 ? 'no active commitments — record one on the Cap Table' : 'count this wire toward an investor’s commitment'}
                    >
                      <select
                        value={fundingCommitmentId}
                        onChange={(e) => {
                          setFundingCommitmentId(e.target.value);
                          persist({ fundingCommitmentId: e.target.value || null } as any);
                        }}
                        className="w-full"
                        disabled={!commitments || commitments.length === 0}
                      >
                        <option value="">— not an investor contribution —</option>
                        {(commitments || []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.personName || 'Unknown investor'} → {ENTITY_LABELS[c.entity as keyof typeof ENTITY_LABELS] || c.entity}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Source of money to pay">
                      <OptionSelect
                        field="source_of_money"
                        value={sourceOfMoney}
                        options={optionLists.source_of_money || []}
                        builtInOptions={{
                          label: 'Money pools (entity · type)',
                          values: [
                            ...BUSINESS_ENTITIES.flatMap((e) => [
                              `${ENTITY_LABELS[e]} revenue`,
                              `${ENTITY_LABELS[e]} investment income`,
                            ]),
                            ...(commitments || []).map((c) =>
                              `${ENTITY_LABELS[c.entity as keyof typeof ENTITY_LABELS] || c.entity} investment income — ${c.personName || 'unknown investor'}`
                            ),
                          ],
                        }}
                        onChange={(v) => { setSourceOfMoney(v); persist({ sourceOfMoney: v || null }); }}
                        onOptionAdded={(v) => addToList('source_of_money', v)}
                      />
                    </Field>
                    {/* Secondary investor picker — only shown when source matches "<Entity> investment income" (without trailing person) */}
                    {(() => {
                      const m = sourceOfMoney.match(/^(.+?) investment income$/);
                      if (!m) return null;
                      const entityLabel = m[1];
                      const matchingEntity = (BUSINESS_ENTITIES as readonly string[]).find((e) => ENTITY_LABELS[e as keyof typeof ENTITY_LABELS] === entityLabel);
                      const matchingCommitments = (commitments || []).filter((c) => c.entity === matchingEntity);
                      return (
                        <Field
                          label={`Which investment? · scoped to ${entityLabel}`}
                          hint={matchingCommitments.length === 0 ? 'no commitments recorded for this entity' : undefined}
                        >
                          <select
                            value=""
                            onChange={(e) => {
                              const personName = e.target.value;
                              if (!personName) return;
                              const newSource = `${entityLabel} investment income — ${personName}`;
                              setSourceOfMoney(newSource);
                              persist({ sourceOfMoney: newSource });
                            }}
                            className="w-full"
                            disabled={matchingCommitments.length === 0}
                          >
                            <option value="">— pick an investor —</option>
                            {matchingCommitments.map((c) => (
                              <option key={c.id} value={c.personName || 'unknown investor'}>
                                {c.personName || 'unknown investor'}
                              </option>
                            ))}
                          </select>
                          {matchingCommitments.length === 0 ? (
                            <div className="text-2xs text-ink-mute mt-1">
                              No investor commitments yet for {entityLabel}. Add one on the <a href={`/cap/${matchingEntity}`} className="text-entity-bytes hover:underline">Cap Table</a> page.
                            </div>
                          ) : null}
                        </Field>
                      );
                    })()}
                    <Field label="Need to get from">
                      <OptionSelect
                        field="need_to_get_from"
                        value={needFrom}
                        options={optionLists.need_to_get_from || []}
                        builtInOptions={{
                          label: 'Your businesses & people',
                          values: [
                            ...BUSINESS_ENTITIES.map((e) => ENTITY_LABELS[e]),
                            ...(people || []).map((p) => p.name),
                          ],
                        }}
                        onChange={(v) => { setNeedFrom(v); persist({ needToGetFrom: v || null }); }}
                        onOptionAdded={(v) => addToList('need_to_get_from', v)}
                      />
                    </Field>
                  </>
                )}
                {tx.amount < 0 ? (
                  <div className="md:col-span-2 rounded-xl border border-line/60 p-3 bg-bg-2/30">
                    <div className="section-label mb-2">
                      Money chain · who got it next?
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Hop 2 · pays to person (as salary)" hint="who personally received this money">
                        <select
                          value={salaryPersonId}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSalaryPersonId(v);
                            // Auto-set isSalary when a person is picked, clear it when blank
                            if (v && !isSalary) {
                              setIsSalary(true);
                              persist({ salaryPersonId: v, isSalary: true, salaryEntity: salaryEntity || (tx.confirmedEntity || tx.entityTag) });
                              if (!salaryEntity) setSalaryEntity((tx.confirmedEntity || tx.entityTag) as string);
                            } else {
                              persist({ salaryPersonId: v || null });
                            }
                          }}
                          className="w-full"
                        >
                          <option value="">— stayed in entity, no person hop —</option>
                          {(people || []).map((p) => (
                            <option key={p.id} value={p.id}>{p.name}{p.role ? ` (${p.role.toLowerCase()})` : ''}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Hop 3 · then forwards to entity" hint="where the money ultimately lands">
                        <select
                          value={passthroughEntity === 'PENDING' ? '' : passthroughEntity}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPassthroughEntity(v);
                            if (!v) {
                              setPassthroughPurpose('');
                              setPassthroughPersonId('');
                              persist({ passthroughEntity: null, passthroughPurpose: null, passthroughPersonId: null });
                            } else {
                              persist({ passthroughEntity: v });
                            }
                          }}
                          className="w-full"
                        >
                          <option value="">— didn&apos;t flow onward —</option>
                          {ENTITY_OPTIONS.map((en) => (
                            <option key={en} value={en}>{ENTITY_LABELS[en]}</option>
                          ))}
                        </select>
                      </Field>
                      {passthroughEntity && passthroughEntity !== 'PENDING' ? (
                        <Field label="Hop 3 · purpose" className="md:col-span-2">
                          <input
                            type="text"
                            value={passthroughPurpose}
                            onChange={(e) => setPassthroughPurpose(e.target.value)}
                            onBlur={() => persist({ passthroughPurpose: passthroughPurpose || null })}
                            placeholder="e.g. Pay restaurant owner debt"
                            className="w-full"
                          />
                        </Field>
                      ) : null}
                    </div>
                  </div>
                ) : null}
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
                    {budgets?.map((b) => (
                      <option key={b.id} value={b.id}>
                        Yes — {b.name}{b.entity ? ` (${b.entity.replace(/_/g, ' ').toLowerCase()})` : ''} · {b.kind === 'INCOME' ? 'income' : 'expense'}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </SectionCard>

            {/* Section 6 — Salary & payroll */}
            <SectionCard
              title="Salary & payroll"
              subtitle="Tag this as a salary / wage payment with entity + recipient"
              collapsibleHidden={!isSalary}
              accent={isSalary ? 'bytes' : undefined}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Is this a salary?" className="md:col-span-2">
                  <select
                    value={isSalary ? '1' : '0'}
                    onChange={(e) => {
                      const v = e.target.value === '1';
                      setIsSalary(v);
                      if (!v) {
                        setSalaryEntity('');
                        setSalaryPersonId('');
                        persist({ isSalary: false, salaryEntity: null, salaryPersonId: null });
                      } else {
                        persist({ isSalary: true });
                      }
                    }}
                    className="w-full"
                  >
                    <option value="0">No</option>
                    <option value="1">Yes — this is a salary / wage payment</option>
                  </select>
                </Field>
                {isSalary ? (
                  <>
                    <Field label="Salary · for which entity">
                      <select
                        value={salaryEntity}
                        onChange={(e) => { setSalaryEntity(e.target.value); persist({ salaryEntity: e.target.value || null }); }}
                        className="w-full"
                      >
                        <option value="">— pick —</option>
                        {ENTITY_OPTIONS.map((e) => (
                          <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Salary · who is it for">
                      <select
                        value={salaryPersonId}
                        onChange={(e) => { setSalaryPersonId(e.target.value); persist({ salaryPersonId: e.target.value || null }); }}
                        className="w-full"
                      >
                        <option value="">— pick —</option>
                        {(people || []).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}{p.role ? ` (${p.role.toLowerCase()})` : ''}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                ) : null}
              </div>
            </SectionCard>

            {/* Section 7 — Passthrough / Sub-tag */}
            <SectionCard
              title="Passed onward · sub-tag for another entity"
              subtitle="When the wire is on one entity but the economic hit belongs to another"
              accent={passthroughEntity ? 'warn' : undefined}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Was this passed onward?" className="md:col-span-2">
                  <select
                    value={passthroughEntity ? '1' : '0'}
                    onChange={(e) => {
                      if (e.target.value === '0') {
                        setPassthroughEntity('');
                        setPassthroughPurpose('');
                        setPassthroughPersonId('');
                        setPassthroughNotes('');
                        persist({ passthroughEntity: null, passthroughPurpose: null, passthroughPersonId: null, passthroughNotes: null });
                      } else {
                        setPassthroughEntity('PENDING');
                      }
                    }}
                    className="w-full"
                  >
                    <option value="0">No — money stayed in this entity</option>
                    <option value="1">Yes — funds were passed onward to another entity / debt</option>
                  </select>
                  <div className="text-2xs text-ink-mute mt-2">
                    Example: Bytes AI pays you a salary, you use that money to fund Delicious Bytes LLC. The bank wire is on Bytes AI, but the economic hit lands on Delicious Bytes.
                  </div>
                </Field>
                {passthroughEntity ? (
                  <>
                    <Field label="Onward · which entity ultimately pays">
                      <select
                        value={passthroughEntity === 'PENDING' ? '' : passthroughEntity}
                        onChange={(e) => { setPassthroughEntity(e.target.value); persist({ passthroughEntity: e.target.value || null }); }}
                        className="w-full"
                      >
                        <option value="">— pick —</option>
                        {ENTITY_OPTIONS.map((en) => (
                          <option key={en} value={en}>{ENTITY_LABELS[en]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Onward · purpose">
                      <input
                        type="text"
                        value={passthroughPurpose}
                        onChange={(e) => setPassthroughPurpose(e.target.value)}
                        onBlur={() => persist({ passthroughPurpose: passthroughPurpose || null })}
                        placeholder="e.g. Pay restaurant owner debt"
                        className="w-full"
                      />
                    </Field>
                    <Field label="Onward · recipient / person">
                      <select
                        value={passthroughPersonId}
                        onChange={(e) => { setPassthroughPersonId(e.target.value); persist({ passthroughPersonId: e.target.value || null }); }}
                        className="w-full"
                      >
                        <option value="">— none —</option>
                        {(people || []).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Onward · notes">
                      <input
                        type="text"
                        value={passthroughNotes}
                        onChange={(e) => setPassthroughNotes(e.target.value)}
                        onBlur={() => persist({ passthroughNotes: passthroughNotes || null })}
                        placeholder="optional context"
                        className="w-full"
                      />
                    </Field>
                  </>
                ) : null}
              </div>
            </SectionCard>

            {/* Section 8 — Notes & docs */}
            <SectionCard title="Notes & documentation" subtitle="Business purpose, receipt link, and freeform notes">
              <div className="grid grid-cols-1 gap-3">
                <Field label="Business purpose">
                  <OptionSelect
                    field="business_purpose"
                    value={purpose}
                    options={optionLists.business_purpose || []}
                    onChange={(v) => { setPurpose(v); persist({ businessPurpose: v || null }); }}
                    onOptionAdded={(v) => addToList('business_purpose', v)}
                    placeholder="— pick a purpose —"
                  />
                </Field>
                <Field label="Doc reference">
                  <input
                    type="text"
                    value={docRef}
                    onChange={(e) => setDocRef(e.target.value)}
                    onBlur={() => persist({ receiptRef: docRef || null })}
                    className="w-full"
                    placeholder="INV-123 / link to file"
                  />
                </Field>
                <Field label="Notes">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => persist({ notes: notes || null })}
                    className="w-full"
                    rows={3}
                    placeholder="anything else"
                  />
                </Field>
              </div>
            </SectionCard>

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
              <div className="text-2xs text-ink-mute ml-auto">Esc to close · changes save automatically</div>
            </div>
          </div>
          {/* Body close */}
        </div>
      </div>
    </Portal>
  );
}

function MoneyFlowChain({
  payingEntity, isSalary, salaryRecipientName, salaryEntityLabel, passthroughEntityLabel, passthroughPurpose, passthroughRecipientName,
}: {
  payingEntity: keyof typeof ENTITY_LABELS;
  isSalary: boolean;
  salaryRecipientName: string | null;
  salaryEntityLabel: string | null;
  passthroughEntityLabel: string | null;
  passthroughPurpose: string;
  passthroughRecipientName: string | null;
}) {
  const payerLabel = salaryEntityLabel || ENTITY_LABELS[payingEntity] || String(payingEntity);
  const nodes: { kind: 'entity' | 'person'; label: string; sub?: string }[] = [];
  nodes.push({ kind: 'entity', label: payerLabel, sub: 'pays from' });
  if (isSalary) {
    nodes.push({ kind: 'person', label: salaryRecipientName || 'Recipient', sub: 'salary / wages' });
  }
  if (passthroughEntityLabel) {
    nodes.push({
      kind: 'entity',
      label: passthroughEntityLabel,
      sub: passthroughPurpose || (passthroughRecipientName ? `pays ${passthroughRecipientName}` : 'economic hit lands here'),
    });
  }
  return (
    <div className="card overflow-hidden border-warn/30">
      <div className="px-5 pt-4 pb-3 border-b border-line/60 flex items-center gap-2">
        <span className="text-sm font-semibold tracking-tight">Money flow chain</span>
        <span className="pill text-2xs bg-warn/15 text-warn border border-warn/30">multi-hop</span>
      </div>
      <div className="p-5">
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {nodes.map((n, i) => (
            <div key={i} className="flex items-stretch gap-2 shrink-0">
              <div className={`flex-1 min-w-[140px] rounded-xl border p-3 ${n.kind === 'entity' ? 'border-entity-bytes/30 bg-entity-bytes/5' : 'border-entity-amari/30 bg-entity-amari/5'}`}>
                <div className="text-2xs uppercase tracking-wider text-ink-mute">
                  {n.kind === 'entity' ? '🏢 Entity' : '👤 Person'}
                </div>
                <div className="text-sm font-semibold mt-0.5 truncate">{n.label}</div>
                {n.sub ? <div className="text-2xs text-ink-mute mt-1">{n.sub}</div> : null}
              </div>
              {i < nodes.length - 1 ? (
                <div className="flex items-center text-ink-mute text-xl select-none">→</div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="text-2xs text-ink-mute mt-2">
          The cash wire is on <span className="text-ink">{payerLabel}</span>&apos;s books.
          {isSalary && salaryRecipientName ? <> It&apos;s booked as salary to <span className="text-ink">{salaryRecipientName}</span>.</> : null}
          {passthroughEntityLabel ? <> The economic hit ultimately lands on <span className="text-ink">{passthroughEntityLabel}</span>.</> : null}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title, subtitle, accent, collapsibleHidden, children,
}: {
  title: string;
  subtitle?: string;
  accent?: 'bytes' | 'income' | 'warn';
  collapsibleHidden?: boolean;
  children: React.ReactNode;
}) {
  if (collapsibleHidden) return null;
  const accentBorder =
    accent === 'bytes' ? 'border-entity-bytes/30' :
    accent === 'income' ? 'border-income/30' :
    accent === 'warn' ? 'border-warn/30' : '';
  return (
    <div className={`card overflow-hidden ${accentBorder}`}>
      <div className="px-5 pt-4 pb-3 border-b border-line/60">
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        {subtitle ? <div className="text-2xs text-ink-mute mt-0.5">{subtitle}</div> : null}
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, className = '', hint }: { label: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="section-label mb-1.5 flex items-center gap-1.5">
        <span>{label}</span>
        {hint ? <span className="text-ink-mute normal-case tracking-normal text-2xs">· {hint}</span> : null}
      </div>
      <div>{children}</div>
    </label>
  );
}
