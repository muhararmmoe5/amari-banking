'use client';

import { useEffect, useState, useTransition } from 'react';
import { Plus, Trash2, Split as SplitIcon, Calendar } from 'lucide-react';
import { ENTITY_LABELS } from '@/constants/accounts';
import type { EntityType } from '@/types';
import { useToast } from '@/components/Toast';
import { fmtMoney } from '@/lib/format';
import {
  listSplitsAction, createSplitAction, updateSplitAction, deleteSplitAction,
} from '../transactions/splitActions';
import type { TransactionSplit } from '@/lib/db/splits';

const KNOWN_ENTITIES: EntityType[] = [
  'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES',
  'BYTES_REST_TECH', 'PERSONAL', 'MULTI_ENTITY', 'BUSINESS_SHARED', 'UNKNOWN',
];

function parseDollarsToCents(s: string): number | null {
  const trimmed = s.trim();
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(trimmed)) return null;
  const neg = trimmed.startsWith('-');
  const abs = neg ? trimmed.slice(1) : trimmed;
  const [whole, frac = ''] = abs.split('.');
  const cents = parseInt(whole, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  return neg ? -cents : cents;
}

function centsToInputStr(c: number): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const m = String(month + 1).padStart(2, '0');
  const last = new Date(year, month + 1, 0).getDate();
  return { start: `${year}-${m}-01`, end: `${year}-${m}-${String(last).padStart(2, '0')}` };
}

function fmtPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  if (start === end) return start || '';
  if (start && end) return `${start} → ${end}`;
  return start || end || '';
}

interface Props {
  transactionId: string;
  transactionAmount: number;
  initialSplits?: TransactionSplit[] | null;
}

interface Draft {
  amount: string;
  entity: string;
  individual: string;
  subCategory1: string;
  businessPurpose: string;
  periodStart: string;
  periodEnd: string;
}

const EMPTY_DRAFT: Draft = {
  amount: '', entity: 'UNKNOWN', individual: '',
  subCategory1: '', businessPurpose: '',
  periodStart: '', periodEnd: '',
};

export default function SplitEditor({ transactionId, transactionAmount, initialSplits }: Props) {
  const [splits, setSplits] = useState<TransactionSplit[] | null>(initialSplits ?? null);
  const [open, setOpen] = useState((initialSplits?.length ?? 0) > 0);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT });
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError, toast } = useToast();

  useEffect(() => {
    if (open && splits == null) {
      listSplitsAction(transactionId)
        .then(setSplits)
        .catch(() => setSplits([]));
    }
  }, [open, splits, transactionId]);

  const txAmountCents = Math.round(transactionAmount * 100);
  const sign = txAmountCents < 0 ? -1 : 1;
  const totalAllocated = (splits || []).reduce((s, x) => s + x.amountCents, 0);
  const remainingCents = txAmountCents - totalAllocated;
  const fullyAllocated = Math.abs(remainingCents) < 1;

  async function addDraft() {
    const cents = parseDollarsToCents(draft.amount);
    if (cents == null || cents === 0) { toast({ kind: 'err', title: 'Invalid amount' }); return; }
    if (sign > 0 ? cents < 0 : cents > 0) {
      toast({ kind: 'err', title: `Splits must be ${sign > 0 ? 'positive' : 'negative'}` });
      return;
    }
    const tId = saveStart();
    startTx(async () => {
      try {
        const s = await createSplitAction({
          transactionId,
          amountCents: cents,
          entity: draft.entity || 'UNKNOWN',
          individual: draft.individual || null,
          subCategory1: draft.subCategory1 || null,
          businessPurpose: draft.businessPurpose || null,
          periodStart: draft.periodStart || null,
          periodEnd: draft.periodEnd || null,
          sortOrder: (splits?.length ?? 0),
        });
        setSplits((cur) => [...(cur || []), s]);
        setDraft({ ...EMPTY_DRAFT });
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  function fillRemaining() {
    if (!fullyAllocated) {
      setDraft((d) => ({ ...d, amount: centsToInputStr(remainingCents) }));
    }
  }

  function applyMonthToDraft(year: number, month: number) {
    const r = monthRange(year, month);
    setDraft((d) => ({ ...d, periodStart: r.start, periodEnd: r.end }));
  }

  async function patchSplit(id: string, patch: Partial<TransactionSplit>) {
    const tId = saveStart();
    startTx(async () => {
      try {
        const actionPatch: any = {};
        if (patch.amountCents !== undefined) actionPatch.amountCents = patch.amountCents;
        if (patch.entity !== undefined) actionPatch.entity = patch.entity;
        if (patch.individual !== undefined) actionPatch.individual = patch.individual;
        if (patch.subCategory1 !== undefined) actionPatch.subCategory1 = patch.subCategory1;
        if (patch.businessPurpose !== undefined) actionPatch.businessPurpose = patch.businessPurpose;
        if (patch.periodStart !== undefined) actionPatch.periodStart = patch.periodStart;
        if (patch.periodEnd !== undefined) actionPatch.periodEnd = patch.periodEnd;
        await updateSplitAction(id, actionPatch);
        setSplits((cur) => (cur || []).map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)));
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  async function removeSplit(id: string) {
    const tId = saveStart();
    startTx(async () => {
      try {
        await deleteSplitAction(id);
        setSplits((cur) => (cur || []).filter((s) => s.id !== id));
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  if (!open) {
    return (
      <div className="pt-2 border-t border-line/60">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-entity-bytes hover:underline inline-flex items-center gap-1"
        >
          <SplitIcon size={12} /> Split this transaction across entities or periods
        </button>
      </div>
    );
  }

  const splitCount = splits?.length ?? 0;
  const remainingTone = fullyAllocated
    ? 'text-income'
    : Math.sign(remainingCents) !== sign
      ? 'text-expense'
      : 'text-warn';

  return (
    <div className="pt-3 border-t border-line/60 space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-mute">
          <SplitIcon size={12} />
          Split allocation
          {splitCount > 0 ? <span className="text-ink-dim normal-case">· {splitCount} line{splitCount === 1 ? '' : 's'}</span> : null}
        </div>
        <div className="text-xs mono tabnum">
          <span className="text-ink-mute">Allocated </span>
          <span className={remainingTone}>{fmtMoney(totalAllocated / 100)}</span>
          <span className="text-ink-mute"> of </span>
          <span>{fmtMoney(transactionAmount)}</span>
          {!fullyAllocated ? (
            <>
              <span className="text-ink-mute"> · </span>
              <span className={remainingTone}>{fmtMoney(remainingCents / 100)} unallocated</span>
            </>
          ) : null}
        </div>
      </div>

      {(splits || []).map((s) => (
        <SplitCard
          key={s.id}
          split={s}
          onChange={(patch) => patchSplit(s.id, patch)}
          onDelete={() => removeSplit(s.id)}
        />
      ))}

      {/* Draft card */}
      <div className="rounded-lg p-3 bg-bg-2 border border-dashed border-line space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-ink-mute">Add a split line</div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <FieldXs label="Amount" className="md:col-span-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder={sign > 0 ? '500.00' : '-500.00'}
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              className="w-full text-xs"
            />
          </FieldXs>
          <FieldXs label="Entity" className="md:col-span-3">
            <input
              list="known-entities"
              value={draft.entity}
              onChange={(e) => setDraft((d) => ({ ...d, entity: e.target.value }))}
              placeholder="Ondine AI, Bytes AI, …"
              className="w-full text-xs"
            />
          </FieldXs>
          <FieldXs label="Individual" className="md:col-span-3">
            <input
              value={draft.individual}
              onChange={(e) => setDraft((d) => ({ ...d, individual: e.target.value }))}
              placeholder="Person / vendor"
              className="w-full text-xs"
            />
          </FieldXs>
          <FieldXs label="Sub category" className="md:col-span-4">
            <input
              value={draft.subCategory1}
              onChange={(e) => setDraft((d) => ({ ...d, subCategory1: e.target.value }))}
              placeholder="e.g. November rent"
              className="w-full text-xs"
            />
          </FieldXs>
          <FieldXs label="Period start" className="md:col-span-3">
            <input
              type="date"
              value={draft.periodStart}
              onChange={(e) => setDraft((d) => ({ ...d, periodStart: e.target.value }))}
              className="w-full text-xs"
            />
          </FieldXs>
          <FieldXs label="Period end" className="md:col-span-3">
            <input
              type="date"
              value={draft.periodEnd}
              onChange={(e) => setDraft((d) => ({ ...d, periodEnd: e.target.value }))}
              className="w-full text-xs"
            />
          </FieldXs>
          <FieldXs label="Description" className="md:col-span-6">
            <input
              value={draft.businessPurpose}
              onChange={(e) => setDraft((d) => ({ ...d, businessPurpose: e.target.value }))}
              placeholder="e.g. November rent for Bytes AI employees"
              className="w-full text-xs"
            />
          </FieldXs>
        </div>
        <MonthShortcuts onPick={applyMonthToDraft} />
        <div className="flex justify-end items-center gap-2 pt-1">
          {!fullyAllocated ? (
            <button
              type="button"
              onClick={fillRemaining}
              className="btn btn-ghost text-[10px] text-warn"
              title="Fill remaining amount"
            >
              fill {fmtMoney(remainingCents / 100)}
            </button>
          ) : null}
          <button type="button" onClick={addDraft} className="btn btn-primary text-xs">
            <Plus size={12} /> Add split
          </button>
        </div>
      </div>

      <datalist id="known-entities">
        {KNOWN_ENTITIES.map((e) => (
          <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
        ))}
      </datalist>

      <div className="text-[10px] text-ink-mute">
        Entity is free text — type any custom name (e.g. <code className="mono">Ondine AI</code>) or pick a known one.
        Period dates let you tag what month/range this allocation covers, even when the charge posted on a different date.
      </div>
    </div>
  );
}

function SplitCard({ split, onChange, onDelete }: {
  split: TransactionSplit;
  onChange: (patch: Partial<TransactionSplit>) => void;
  onDelete: () => void;
}) {
  const [amountStr, setAmountStr] = useState(centsToInputStr(split.amountCents));
  const [entity, setEntity] = useState(split.entity);
  const [individual, setIndividual] = useState(split.individual || '');
  const [sub1, setSub1] = useState(split.subCategory1 || '');
  const [purpose, setPurpose] = useState(split.businessPurpose || '');
  const [periodStart, setPeriodStart] = useState(split.periodStart || '');
  const [periodEnd, setPeriodEnd] = useState(split.periodEnd || '');

  function commitAmount() {
    const c = parseDollarsToCents(amountStr);
    if (c != null && c !== split.amountCents) onChange({ amountCents: c });
  }

  function applyMonth(year: number, month: number) {
    const r = monthRange(year, month);
    setPeriodStart(r.start);
    setPeriodEnd(r.end);
    onChange({ periodStart: r.start, periodEnd: r.end });
  }

  return (
    <div className="rounded-lg p-3 bg-bg-2 border border-line space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <FieldXs label="Amount" className="md:col-span-2">
          <input
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            onBlur={commitAmount}
            className="w-full text-xs"
          />
        </FieldXs>
        <FieldXs label="Entity" className="md:col-span-3">
          <input
            list="known-entities"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            onBlur={() => entity !== split.entity && onChange({ entity })}
            className="w-full text-xs"
          />
        </FieldXs>
        <FieldXs label="Individual" className="md:col-span-3">
          <input
            value={individual}
            onChange={(e) => setIndividual(e.target.value)}
            onBlur={() => onChange({ individual: individual || null })}
            className="w-full text-xs"
            placeholder="Person / vendor"
          />
        </FieldXs>
        <FieldXs label="Sub category" className="md:col-span-3">
          <input
            value={sub1}
            onChange={(e) => setSub1(e.target.value)}
            onBlur={() => onChange({ subCategory1: sub1 || null })}
            className="w-full text-xs"
            placeholder="e.g. November rent"
          />
        </FieldXs>
        <div className="md:col-span-1 flex items-end justify-end">
          <button onClick={onDelete} className="btn btn-ghost !p-1.5 text-expense" title="Remove split"><Trash2 size={12} /></button>
        </div>
        <FieldXs label="Period start" className="md:col-span-3">
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            onBlur={() => onChange({ periodStart: periodStart || null })}
            className="w-full text-xs"
          />
        </FieldXs>
        <FieldXs label="Period end" className="md:col-span-3">
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            onBlur={() => onChange({ periodEnd: periodEnd || null })}
            className="w-full text-xs"
          />
        </FieldXs>
        <FieldXs label="Description" className="md:col-span-6">
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            onBlur={() => onChange({ businessPurpose: purpose || null })}
            className="w-full text-xs"
            placeholder="What this portion was for"
          />
        </FieldXs>
      </div>
      <MonthShortcuts onPick={applyMonth} />
      {(split.periodStart || split.periodEnd) ? (
        <div className="text-[10px] text-ink-mute inline-flex items-center gap-1">
          <Calendar size={10} /> Covers {fmtPeriod(split.periodStart, split.periodEnd)}
        </div>
      ) : null}
    </div>
  );
}

function MonthShortcuts({ onPick }: { onPick: (year: number, month: number) => void }) {
  const now = new Date();
  // Show last 6 months as quick chips, newest first.
  const items: { label: string; year: number; month: number }[] = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    items.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px]">
      <span className="text-ink-mute mr-1 inline-flex items-center gap-1"><Calendar size={10} /> Quick month:</span>
      {items.map((m) => (
        <button
          key={`${m.year}-${m.month}`}
          type="button"
          onClick={() => onPick(m.year, m.month)}
          className="px-2 py-0.5 rounded border border-line bg-bg-3 hover:border-entity-bytes/40 hover:text-ink text-ink-dim"
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function FieldXs({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">{label}</div>
      <div>{children}</div>
    </label>
  );
}
