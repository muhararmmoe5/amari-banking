'use client';

/**
 * Per-split-row UI that mirrors the BookedAttribution flow:
 *   Personal/Business toggle → Entity/Category/Sub-category dropdowns.
 *
 * Persists to the same `transaction_splits` table via splitActions, reusing:
 *   entity            : 'PERSONAL' marker OR an EntityType code for business
 *   sub_category_1    : the category bucket key (e.g. 'PAYROLL' or 'FAMILY')
 *   sub_category_2    : the picked sub-category string
 *   individual        : person / counterparty text
 *   business_purpose  : free-text description
 */

import { useEffect, useState, useTransition } from 'react';
import { Plus, X, User, Building2, Split as SplitIcon, Lock, ArrowRight, StickyNote, Repeat } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { fmtMoney } from '@/lib/format';
import {
  listSplitsAction, createSplitAction, updateSplitAction, deleteSplitAction,
} from './splitActions';
import type { TransactionSplit } from '@/lib/db/splits';
import type { EntityType } from '@/types';
import { ENTITY_LABELS, ENTITY_COLORS, BUSINESS_ENTITIES, ACCOUNTS } from '@/constants/accounts';
import { BUSINESS_CATEGORIES, PERSONAL_CATEGORIES } from '@/constants/categories';
import PersonPicker from '@/components/PersonPicker';

interface Props {
  transactionId: string;
  transactionAmount: number;
}

const ROW_COLORS = ['var(--purple)', 'var(--gold)', 'var(--blue)', 'var(--income)'];

function getPath(entity: string): 'PERSONAL' | 'BUSINESS' | null {
  if (entity === 'PERSONAL') return 'PERSONAL';
  if (entity && entity !== 'UNKNOWN' && BUSINESS_ENTITIES.includes(entity as EntityType)) return 'BUSINESS';
  return null;
}

export default function DrawerSplitEditor({ transactionId, transactionAmount }: Props) {
  const { saveStart, saveEnd, saveError, toast } = useToast();
  const [splits, setSplits] = useState<TransactionSplit[] | null>(null);
  const [, startTx] = useTransition();

  useEffect(() => {
    listSplitsAction(transactionId)
      .then((rows) => setSplits(rows || []))
      .catch(() => setSplits([]));
  }, [transactionId]);

  const totalCents = Math.round(Math.abs(transactionAmount) * 100);
  const sign = transactionAmount < 0 ? -1 : 1;
  const allocated = (splits || []).reduce((s, x) => s + Math.abs(x.amountCents), 0);
  const remaining = totalCents - allocated;
  const isMatched = Math.abs(remaining) < 1;
  const isOver = remaining < -1;

  function addRow(amountCents: number) {
    const id = saveStart();
    startTx(async () => {
      try {
        const s = await createSplitAction({
          transactionId,
          amountCents: sign * Math.abs(amountCents),
          entity: 'UNKNOWN',
          sortOrder: splits?.length ?? 0,
        });
        setSplits((cur) => [...(cur || []), s]);
        saveEnd(id);
      } catch (e: any) { saveError(id, e?.message); }
    });
  }

  function seedTwoFiftyFifty() {
    const half = Math.round(totalCents / 2);
    const id1 = saveStart();
    startTx(async () => {
      try {
        const a = await createSplitAction({
          transactionId, amountCents: sign * half, entity: 'UNKNOWN', sortOrder: 0,
        });
        const b = await createSplitAction({
          transactionId, amountCents: sign * (totalCents - half), entity: 'UNKNOWN', sortOrder: 1,
        });
        setSplits([a, b]);
        saveEnd(id1);
      } catch (e: any) { saveError(id1, e?.message); }
    });
  }

  function patchRow(rowId: string, patch: Partial<TransactionSplit>) {
    setSplits((cur) => (cur || []).map((s) => (s.id === rowId ? { ...s, ...patch } : s)));
    const id = saveStart();
    startTx(async () => {
      try {
        const actionPatch: any = {};
        if (patch.amountCents !== undefined) actionPatch.amountCents = patch.amountCents;
        if (patch.entity !== undefined) actionPatch.entity = patch.entity;
        if (patch.individual !== undefined) actionPatch.individual = patch.individual;
        if (patch.subCategory1 !== undefined) actionPatch.subCategory1 = patch.subCategory1;
        if (patch.subCategory2 !== undefined) actionPatch.subCategory2 = patch.subCategory2;
        if (patch.businessPurpose !== undefined) actionPatch.businessPurpose = patch.businessPurpose;
        if (patch.notes !== undefined) actionPatch.notes = patch.notes;
        if (patch.sourceEntity !== undefined) actionPatch.sourceEntity = patch.sourceEntity;
        if (patch.sourceAccountId !== undefined) actionPatch.sourceAccountId = patch.sourceAccountId;
        if (patch.isRecurring !== undefined) actionPatch.isRecurring = patch.isRecurring;
        if (patch.recurringFrequency !== undefined) actionPatch.recurringFrequency = patch.recurringFrequency;
        if (patch.recurringNextDate !== undefined) actionPatch.recurringNextDate = patch.recurringNextDate;
        if (patch.recurringLabel !== undefined) actionPatch.recurringLabel = patch.recurringLabel;
        if (patch.recurringAlertDays !== undefined) actionPatch.recurringAlertDays = patch.recurringAlertDays;
        if (patch.recurringExpectedCents !== undefined) actionPatch.recurringExpectedCents = patch.recurringExpectedCents;
        await updateSplitAction(rowId, actionPatch);
        saveEnd(id);
      } catch (e: any) { saveError(id, e?.message); }
    });
  }

  function removeRow(rowId: string) {
    setSplits((cur) => (cur || []).filter((s) => s.id !== rowId));
    const id = saveStart();
    startTx(async () => {
      try { await deleteSplitAction(rowId); saveEnd(id); }
      catch (e: any) { saveError(id, e?.message); }
    });
  }

  if (splits === null) {
    return <div className="text-[11px] text-ink-mute">Loading splits…</div>;
  }

  // No splits yet — show seed CTA
  if (splits.length === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="text-[11.5px] text-ink-mute">
          Seed two equal parts to get started, then categorize each part below.
        </div>
        <button
          type="button"
          onClick={seedTwoFiftyFifty}
          className="btn"
          style={{
            justifyContent: 'center',
            background: 'transparent',
            border: '0.5px dashed var(--border-default, rgba(255,255,255,0.12))',
            color: 'var(--ink-3)',
            padding: '12px 0',
          }}
        >
          <SplitIcon size={12} /> Seed 2 equal parts ({fmtMoney(Math.abs(transactionAmount) / 2)} each)
        </button>
        <button
          type="button"
          onClick={() => addRow(Math.round(totalCents / 2))}
          className="btn btn-sm"
          style={{
            alignSelf: 'flex-end',
            background: 'rgba(167,139,250,0.12)',
            borderColor: 'rgba(167,139,250,0.30)',
            color: 'var(--purple)',
          }}
        >
          <Plus size={11} /> Add a single part
        </button>
      </div>
    );
  }

  // Compute inter-entity owings rollup
  const owings = new Map<string, number>(); // key: `${owner}>${source}` → cents
  for (const s of splits) {
    if (!s.sourceEntity || !s.entity) continue;
    if (s.sourceEntity === s.entity) continue;
    if (s.sourceEntity === 'UNKNOWN' || s.entity === 'UNKNOWN') continue;
    const key = `${s.entity}>${s.sourceEntity}`;
    owings.set(key, (owings.get(key) || 0) + Math.abs(s.amountCents));
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Owings summary */}
      {owings.size > 0 ? (
        <div
          style={{
            padding: '8px 12px',
            background: 'rgba(251,191,36,0.06)',
            border: '0.5px solid rgba(251,191,36,0.25)',
            borderRadius: 8,
          }}
        >
          <div
            className="field-label"
            style={{ color: 'var(--warn)', marginBottom: 6 }}
          >
            Inter-entity owings created by this split
          </div>
          <div className="flex flex-col gap-1">
            {Array.from(owings.entries()).map(([key, cents]) => {
              const [owner, source] = key.split('>');
              return (
                <div key={key} className="flex items-center gap-1.5 text-[11.5px]">
                  <span className="font-medium" style={{ color: 'var(--ink)' }}>
                    {(ENTITY_LABELS as any)[owner] || owner}
                  </span>
                  <ArrowRight size={11} className="text-ink-mute" />
                  <span>owes</span>
                  <span className="font-medium" style={{ color: 'var(--ink)' }}>
                    {(ENTITY_LABELS as any)[source] || source}
                  </span>
                  <span className="flex-1" />
                  <span className="num font-semibold" style={{ color: 'var(--warn)' }}>
                    {fmtMoney(cents / 100)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Allocation bar */}
      <div
        style={{
          padding: '10px 12px',
          background: 'var(--bg-3)',
          border: '0.5px solid var(--border-subtle)',
          borderRadius: 8,
        }}
      >
        <div className="flex justify-between text-[11px] mb-1.5">
          <span className="text-ink-mute">Allocation</span>
          <span
            className="num font-semibold"
            style={{
              color: isMatched ? 'var(--income)' : isOver ? 'var(--expense)' : 'var(--warn)',
            }}
          >
            {fmtMoney(allocated / 100)} of {fmtMoney(totalCents / 100)}
            {isMatched
              ? ' · matched ✓'
              : isOver
                ? ` · over by ${fmtMoney(Math.abs(remaining) / 100)}`
                : ` · ${fmtMoney(remaining / 100)} left`}
          </span>
        </div>
        <div
          style={{
            height: 4, background: 'var(--bg-2)', borderRadius: 2,
            overflow: 'hidden', display: 'flex', gap: 1,
          }}
        >
          {splits.map((s, i) => (
            <div
              key={s.id}
              style={{
                width: `${Math.min(100, (Math.abs(s.amountCents) / totalCents) * 100)}%`,
                background: ROW_COLORS[i % ROW_COLORS.length],
                transition: 'width 220ms ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Rows */}
      {splits.map((s, i) => (
        <SplitRow
          key={s.id}
          index={i}
          split={s}
          sign={sign}
          onPatch={(p) => patchRow(s.id, p)}
          onRemove={() => removeRow(s.id)}
        />
      ))}

      {/* Add another */}
      <button
        type="button"
        onClick={() => addRow(Math.max(0, remaining))}
        className="btn"
        style={{
          width: '100%',
          justifyContent: 'center',
          background: 'transparent',
          border: '0.5px dashed var(--border-default, rgba(255,255,255,0.12))',
          color: 'var(--ink-3)',
          padding: '10px 0',
        }}
      >
        <Plus size={12} /> Add another part
      </button>
    </div>
  );
}

function SplitRow({
  index, split, sign, onPatch, onRemove,
}: {
  index: number;
  split: TransactionSplit;
  sign: number;
  onPatch: (p: Partial<TransactionSplit>) => void;
  onRemove: () => void;
}) {
  const color = ROW_COLORS[index % ROW_COLORS.length];
  const path = getPath(split.entity);
  const isP = path === 'PERSONAL';
  const isB = path === 'BUSINESS';

  const [amountStr, setAmountStr] = useState((Math.abs(split.amountCents) / 100).toFixed(2));

  function commitAmount() {
    const num = Number(amountStr.replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(num) || num < 0) return;
    const cents = Math.round(num * 100);
    if (cents !== Math.abs(split.amountCents)) {
      onPatch({ amountCents: sign * cents });
    }
  }

  return (
    <div
      style={{
        padding: '14px 14px 14px 12px',
        background: 'var(--bg-3)',
        border: '0.5px solid var(--border-subtle)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
      }}
    >
      {/* Top row — letter + amount + remove */}
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="grid place-items-center"
          style={{
            width: 22, height: 22, borderRadius: 50,
            background: color, color: 'var(--bg-0)',
            fontWeight: 700, fontSize: 10.5,
          }}
        >
          {String.fromCharCode(65 + index)}
        </span>
        <span
          className="text-[11px] font-semibold uppercase"
          style={{ color: 'var(--ink-3)', letterSpacing: '.08em' }}
        >
          Part {String.fromCharCode(65 + index)}
        </span>
        <span className="flex-1" />
        <span className="text-[10px] text-ink-mute">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          onBlur={commitAmount}
          className="num"
          style={{ width: 110, height: 28, padding: '0 8px', fontSize: 12, textAlign: 'right' }}
        />
        <button
          type="button"
          onClick={onRemove}
          className="btn btn-ghost btn-sm"
          style={{ padding: 4 }}
          title="Remove this part"
        >
          <X size={11} />
        </button>
      </div>

      {/* Personal / Business mini-toggle */}
      <div className="grid grid-cols-2 gap-1.5 mb-2.5">
        <MiniPathButton
          active={isP}
          color="var(--purple)"
          icon={<User size={11} />}
          label="Personal"
          onClick={() => onPatch({ entity: 'PERSONAL', subCategory1: null, subCategory2: null })}
        />
        <MiniPathButton
          active={isB}
          color="var(--gold)"
          icon={<Building2 size={11} />}
          label="Business"
          onClick={() => {
            // Pick a sensible default entity if none yet
            const nextEntity = BUSINESS_ENTITIES.includes(split.entity as EntityType)
              ? split.entity
              : BUSINESS_ENTITIES[0];
            onPatch({ entity: nextEntity, subCategory1: null, subCategory2: null });
          }}
        />
      </div>

      {/* Path-specific UI */}
      {isB ? <BusinessRowBody split={split} onPatch={onPatch} /> : null}
      {isP ? <PersonalRowBody split={split} onPatch={onPatch} /> : null}

      {!path ? (
        <div className="text-[11px] text-ink-mute text-center py-1">
          Pick personal or business to categorize this part
        </div>
      ) : null}

      {/* Source of money for THIS part — supports inter-entity owings */}
      {path ? (
        <SplitSourceOfMoney split={split} onPatch={onPatch} />
      ) : null}

      {/* Per-split recurrence — each part can be recurring independently */}
      {path ? (
        <SplitRecurrence split={split} onPatch={onPatch} />
      ) : null}

      {/* Per-split notes — tag each part on its own */}
      {path ? (
        <SplitNotes split={split} onPatch={onPatch} />
      ) : null}
    </div>
  );
}

function SplitRecurrence({
  split, onPatch,
}: {
  split: TransactionSplit;
  onPatch: (p: Partial<TransactionSplit>) => void;
}) {
  const isRec = !!split.isRecurring;
  const frequency = split.recurringFrequency || 'MONTHLY';
  const expectedDollars = split.recurringExpectedCents != null
    ? (split.recurringExpectedCents / 100).toFixed(2)
    : (Math.abs(split.amountCents) / 100).toFixed(2);
  const [amountStr, setAmountStr] = useState(expectedDollars);
  const [label, setLabel] = useState(split.recurringLabel || '');

  // Re-sync local state if the underlying split changes externally (e.g. amount edit)
  useEffect(() => {
    if (split.recurringExpectedCents == null) {
      setAmountStr((Math.abs(split.amountCents) / 100).toFixed(2));
    }
  }, [split.amountCents, split.recurringExpectedCents]);

  return (
    <div
      className="mt-2.5"
      style={{
        padding: '10px 12px',
        background: isRec ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.02)',
        border: '0.5px solid ' + (isRec ? 'rgba(251,191,36,0.30)' : 'var(--border-subtle, rgba(255,255,255,0.07))'),
        borderRadius: 7,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Repeat size={11} style={{ color: isRec ? 'var(--warn)' : 'var(--ink-mute)' }} />
        <span
          className="field-label"
          style={{ marginBottom: 0, color: isRec ? 'var(--warn)' : undefined }}
        >
          Recurrence for this part
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onPatch({
            isRecurring: !isRec,
            // Seed defaults when first turning on
            recurringFrequency: !isRec && !split.recurringFrequency ? 'MONTHLY' : split.recurringFrequency,
          })}
          className="btn btn-sm"
          style={{
            padding: '3px 8px',
            fontSize: 10.5,
            background: isRec ? 'rgba(251,191,36,0.16)' : 'var(--bg-2)',
            borderColor: isRec ? 'rgba(251,191,36,0.40)' : 'var(--border-default, rgba(255,255,255,0.12))',
            color: isRec ? 'var(--warn)' : 'var(--ink-2)',
          }}
        >
          {isRec ? 'Recurring · ON' : 'One-time'}
        </button>
      </div>

      {isRec ? (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {/* Frequency segmented control */}
          <div
            className="flex p-0.5"
            style={{
              gap: 2,
              background: 'var(--bg-2)',
              border: '0.5px solid var(--border-subtle, rgba(255,255,255,0.07))',
              borderRadius: 6,
            }}
          >
            {['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'QUARTERLY', 'ANNUAL'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onPatch({ recurringFrequency: f })}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  borderRadius: 4,
                  background: frequency === f ? 'var(--bg-0)' : 'transparent',
                  color: frequency === f ? 'var(--ink)' : 'var(--ink-3)',
                  fontSize: 10.5,
                  fontWeight: 500,
                }}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Expected amount + Next due date */}
          <div className="grid grid-cols-2" style={{ gap: 8 }}>
            <div>
              <div className="field-label" style={{ marginBottom: 4 }}>Expected amount</div>
              <input
                type="text"
                inputMode="decimal"
                className="num"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                onBlur={() => {
                  const num = Number(String(amountStr).replace(/[^0-9.\-]/g, ''));
                  const cents = Number.isFinite(num) && num > 0 ? Math.round(num * 100) : null;
                  if (cents !== split.recurringExpectedCents) {
                    onPatch({ recurringExpectedCents: cents });
                  }
                }}
                style={{ fontSize: 12, height: 28 }}
              />
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: 4 }}>Next due date</div>
              <input
                type="date"
                value={split.recurringNextDate || ''}
                onChange={(e) => onPatch({ recurringNextDate: e.target.value || null })}
                style={{ fontSize: 12, height: 28 }}
              />
            </div>
          </div>

          {/* Label + Alert days */}
          <div className="grid grid-cols-2" style={{ gap: 8 }}>
            <div>
              <div className="field-label" style={{ marginBottom: 4 }}>Label</div>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => {
                  const next = label.trim() || null;
                  if (next !== (split.recurringLabel || null)) onPatch({ recurringLabel: next });
                }}
                placeholder="e.g. NYC Team Apartment 1"
                style={{ fontSize: 12, height: 28 }}
              />
            </div>
            <div>
              <div className="field-label" style={{ marginBottom: 4 }}>Alert days before</div>
              <select
                value={split.recurringAlertDays ?? 3}
                onChange={(e) => onPatch({ recurringAlertDays: Number(e.target.value) })}
                style={{ fontSize: 12, height: 28 }}
              >
                <option value="1">1 day before</option>
                <option value="3">3 days before</option>
                <option value="7">7 days before</option>
                <option value="14">14 days before</option>
              </select>
            </div>
          </div>

          <div className="text-[10px] text-ink-mute">
            Books to <span className="font-medium" style={{ color: 'var(--ink-2)' }}>
              {(ENTITY_LABELS as any)[split.entity] || split.entity}
            </span> every {frequency.toLowerCase()} — rolls forward until you switch this off.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SplitNotes({
  split, onPatch,
}: {
  split: TransactionSplit;
  onPatch: (p: Partial<TransactionSplit>) => void;
}) {
  const [val, setVal] = useState(split.notes || '');
  return (
    <div className="mt-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <StickyNote size={11} className="text-ink-mute" />
        <span className="field-label" style={{ marginBottom: 0 }}>
          Notes for this part
        </span>
      </div>
      <textarea
        value={val}
        rows={2}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const next = val.trim() || null;
          if (next !== (split.notes || null)) onPatch({ notes: next });
        }}
        placeholder="Why this part exists, who it's really for, anything to remember…"
        style={{ fontSize: 12, resize: 'vertical', minHeight: 50 }}
      />
    </div>
  );
}

function SplitSourceOfMoney({
  split, onPatch,
}: {
  split: TransactionSplit;
  onPatch: (p: Partial<TransactionSplit>) => void;
}) {
  const owner = split.entity;
  const source = split.sourceEntity;
  const owes = !!source && source !== owner && source !== 'UNKNOWN' && owner !== 'UNKNOWN';
  const accountsForSource = source
    ? ACCOUNTS.filter((a) => a.entity === source && a.isActive)
    : [];

  const ownerLabel = (ENTITY_LABELS as any)[owner] || owner;
  const sourceLabel = source ? ((ENTITY_LABELS as any)[source] || source) : null;
  const amount = Math.abs(split.amountCents) / 100;

  return (
    <div
      className="mt-2.5"
      style={{
        padding: '10px 12px',
        background: 'rgba(74,222,128,0.04)',
        border: '0.5px solid rgba(74,222,128,0.20)',
        borderRadius: 7,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Lock size={11} style={{ color: 'var(--income)' }} />
        <span
          className="field-label"
          style={{ color: 'var(--income)', marginBottom: 0 }}
        >
          Source of money — who paid for this part
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={source || ''}
          onChange={(e) => onPatch({
            sourceEntity: e.target.value || null,
            sourceAccountId: null,
          })}
          style={{ height: 30, fontSize: 12 }}
        >
          <option value="">— pick funding entity —</option>
          <optgroup label="Suggested">
            <option value="AMARI_HOLDINGS">Amari Muharram Holdings</option>
          </optgroup>
          <optgroup label="Business entities">
            {BUSINESS_ENTITIES.filter((k) => k !== 'AMARI_HOLDINGS').map((k) => (
              <option key={k} value={k}>{(ENTITY_LABELS as any)[k]}</option>
            ))}
          </optgroup>
          <optgroup label="Other">
            <option value="PERSONAL">Personal</option>
          </optgroup>
        </select>
        <select
          value={split.sourceAccountId || ''}
          onChange={(e) => onPatch({ sourceAccountId: e.target.value || null })}
          disabled={!source || accountsForSource.length === 0}
          style={{ height: 30, fontSize: 12 }}
        >
          <option value="">
            {!source
              ? 'pick entity first'
              : accountsForSource.length === 0
                ? 'no accounts'
                : 'Account (optional)'}
          </option>
          {accountsForSource.map((a) => (
            <option key={a.id} value={a.id}>····{a.id} · {a.label}</option>
          ))}
        </select>
      </div>

      {owes ? (
        <div
          className="mt-2 flex items-center gap-1.5 text-[11px]"
          style={{ color: 'var(--warn)' }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: 50, background: 'var(--warn)',
            }}
          />
          <span className="font-medium">{ownerLabel}</span>
          <ArrowRight size={11} className="opacity-60" />
          <span>owes</span>
          <span className="font-medium">{sourceLabel}</span>
          <span className="num">{fmtMoney(amount)}</span>
        </div>
      ) : null}
    </div>
  );
}

function MiniPathButton({
  active, color, icon, label, onClick,
}: {
  active: boolean; color: string; icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5"
      style={{
        padding: '6px 8px',
        borderRadius: 6,
        background: active ? `color-mix(in oklab, ${color} 14%, var(--bg-2))` : 'var(--bg-2)',
        border: '0.5px solid ' + (active ? color : 'var(--border-default, rgba(255,255,255,0.12))'),
        color: active ? color : 'var(--ink-2)',
        fontSize: 11.5,
        fontWeight: 500,
      }}
    >
      {icon} {label}
    </button>
  );
}

function BusinessRowBody({
  split, onPatch,
}: {
  split: TransactionSplit;
  onPatch: (p: Partial<TransactionSplit>) => void;
}) {
  const cat = split.subCategory1 ? BUSINESS_CATEGORIES[split.subCategory1] : null;
  return (
    <div className="flex flex-col gap-2">
      {/* Entity chip grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {BUSINESS_ENTITIES.map((k) => {
          const c = ENTITY_COLORS[k];
          const active = split.entity === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPatch({ entity: k })}
              className="inline-flex items-center gap-1.5 text-left"
              style={{
                padding: '6px 9px',
                borderRadius: 6,
                background: active ? `color-mix(in oklab, ${c} 14%, var(--bg-2))` : 'var(--bg-2)',
                border: '0.5px solid ' + (active ? c : 'var(--border-default, rgba(255,255,255,0.12))'),
                color: active ? 'var(--ink)' : 'var(--ink-2)',
                fontSize: 11.5,
                fontWeight: 500,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 50, background: c }} />
              {ENTITY_LABELS[k]}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select
          value={split.subCategory1 || ''}
          onChange={(e) => onPatch({ subCategory1: e.target.value || null, subCategory2: null })}
          style={{ height: 30, fontSize: 12 }}
        >
          <option value="">Category…</option>
          {Object.entries(BUSINESS_CATEGORIES).map(([k, c]) => (
            <option key={k} value={k}>{c.label}</option>
          ))}
        </select>
        <select
          value={split.subCategory2 || ''}
          onChange={(e) => onPatch({ subCategory2: e.target.value || null })}
          disabled={!cat}
          style={{ height: 30, fontSize: 12 }}
        >
          <option value="">{cat ? 'Sub-category…' : 'pick category first'}</option>
          {cat?.subs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <PersonPicker
        value={split.individual || ''}
        onChange={(name) => onPatch({ individual: name || null })}
        placeholder="Individual / counterparty (optional)"
        compact
      />
    </div>
  );
}

function PersonalRowBody({
  split, onPatch,
}: {
  split: TransactionSplit;
  onPatch: (p: Partial<TransactionSplit>) => void;
}) {
  const cat = split.subCategory1 ? PERSONAL_CATEGORIES[split.subCategory1] : null;
  return (
    <div className="flex flex-col gap-2">
      <PersonPicker
        value={split.individual || ''}
        onChange={(name) => onPatch({ individual: name || null })}
        placeholder="Whose personal expense / counterparty"
        compact
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={split.subCategory1 || ''}
          onChange={(e) => onPatch({ subCategory1: e.target.value || null, subCategory2: null })}
          style={{ height: 30, fontSize: 12 }}
        >
          <option value="">Category…</option>
          {Object.entries(PERSONAL_CATEGORIES).map(([k, c]) => (
            <option key={k} value={k}>{c.label}</option>
          ))}
        </select>
        <select
          value={split.subCategory2 || ''}
          onChange={(e) => onPatch({ subCategory2: e.target.value || null })}
          disabled={!cat}
          style={{ height: 30, fontSize: 12 }}
        >
          <option value="">{cat ? 'Sub-category…' : 'pick category first'}</option>
          {cat?.subs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}
