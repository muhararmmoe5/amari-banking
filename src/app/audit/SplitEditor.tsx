'use client';

import { useEffect, useState, useTransition } from 'react';
import { Plus, Trash2, Split as SplitIcon } from 'lucide-react';
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

interface Props {
  transactionId: string;
  transactionAmount: number; // dollars, positive for inflow, negative for outflow
  initialSplits?: TransactionSplit[] | null;
}

interface Draft {
  amount: string;             // dollar string input
  entity: string;
  category: string;
  individual: string;
  subCategory1: string;
  subCategory2: string;
  businessPurpose: string;
  notes: string;
}

const EMPTY_DRAFT: Draft = {
  amount: '', entity: 'UNKNOWN', category: '', individual: '',
  subCategory1: '', subCategory2: '', businessPurpose: '', notes: '',
};

export default function SplitEditor({ transactionId, transactionAmount, initialSplits }: Props) {
  const [splits, setSplits] = useState<TransactionSplit[] | null>(initialSplits ?? null);
  const [open, setOpen] = useState((initialSplits?.length ?? 0) > 0);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT });
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError, toast } = useToast();

  useEffect(() => {
    if (open && splits == null) {
      // Lazy load
      listSplitsAction(transactionId)
        .then(setSplits)
        .catch(() => setSplits([]));
    }
  }, [open, splits, transactionId]);

  const txAmountCents = Math.round(transactionAmount * 100);
  const sign = txAmountCents < 0 ? -1 : 1;
  const totalAllocated = (splits || []).reduce((s, x) => s + x.amountCents, 0);
  const remainingCents = txAmountCents - totalAllocated;
  const remainingAbs = Math.abs(remainingCents);
  const fullyAllocated = Math.abs(remainingCents) < 1;

  async function addDraft() {
    const cents = parseDollarsToCents(draft.amount);
    if (cents == null || cents === 0) {
      toast({ kind: 'err', title: 'Invalid amount' });
      return;
    }
    // Sign must match the parent transaction
    if (sign > 0 ? cents < 0 : cents > 0) {
      toast({ kind: 'err', title: `Splits must be ${sign > 0 ? 'positive' : 'negative'} on this transaction` });
      return;
    }
    const tId = saveStart();
    startTx(async () => {
      try {
        const s = await createSplitAction({
          transactionId,
          amountCents: cents,
          entity: draft.entity || 'UNKNOWN',
          category: draft.category || null,
          individual: draft.individual || null,
          subCategory1: draft.subCategory1 || null,
          subCategory2: draft.subCategory2 || null,
          businessPurpose: draft.businessPurpose || null,
          notes: draft.notes || null,
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

  async function patchSplit(id: string, patch: Partial<TransactionSplit>) {
    const tId = saveStart();
    startTx(async () => {
      try {
        // Translate UI patch to action input
        const actionPatch: any = {};
        if (patch.amountCents !== undefined) actionPatch.amountCents = patch.amountCents;
        if (patch.entity !== undefined) actionPatch.entity = patch.entity;
        if (patch.category !== undefined) actionPatch.category = patch.category;
        if (patch.individual !== undefined) actionPatch.individual = patch.individual;
        if (patch.subCategory1 !== undefined) actionPatch.subCategory1 = patch.subCategory1;
        if (patch.subCategory2 !== undefined) actionPatch.subCategory2 = patch.subCategory2;
        if (patch.businessPurpose !== undefined) actionPatch.businessPurpose = patch.businessPurpose;
        if (patch.notes !== undefined) actionPatch.notes = patch.notes;
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
          <SplitIcon size={12} /> Split this transaction across multiple entities
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
        <SplitRow
          key={s.id}
          split={s}
          onChange={(patch) => patchSplit(s.id, patch)}
          onDelete={() => removeSplit(s.id)}
        />
      ))}

      {/* Draft row */}
      <div className="rounded-md p-2 bg-bg-2 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Amount</div>
          <input
            type="text"
            inputMode="decimal"
            placeholder={sign > 0 ? '500.00' : '-500.00'}
            value={draft.amount}
            onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            className="w-full text-xs"
          />
        </div>
        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Entity</div>
          <input
            list="known-entities"
            value={draft.entity}
            onChange={(e) => setDraft((d) => ({ ...d, entity: e.target.value }))}
            placeholder="Ondine AI, Bytes AI, …"
            className="w-full text-xs"
          />
        </div>
        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Individual</div>
          <input
            value={draft.individual}
            onChange={(e) => setDraft((d) => ({ ...d, individual: e.target.value }))}
            placeholder="Person"
            className="w-full text-xs"
          />
        </div>
        <div className="md:col-span-2">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Sub category</div>
          <input
            value={draft.subCategory1}
            onChange={(e) => setDraft((d) => ({ ...d, subCategory1: e.target.value }))}
            placeholder="e.g. Employee rent"
            className="w-full text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Business purpose</div>
          <input
            value={draft.businessPurpose}
            onChange={(e) => setDraft((d) => ({ ...d, businessPurpose: e.target.value }))}
            placeholder="What this portion was for"
            className="w-full text-xs"
          />
        </div>
        <div className="md:col-span-1 flex flex-col gap-1">
          {!fullyAllocated ? (
            <button
              type="button"
              onClick={fillRemaining}
              title="Fill remaining"
              className="btn btn-ghost !p-1 text-[10px] text-warn"
            >
              fill {fmtMoney(remainingCents / 100)}
            </button>
          ) : null}
          <button type="button" onClick={addDraft} className="btn btn-primary !p-1.5" title="Add split">
            <Plus size={12} />
          </button>
        </div>
      </div>

      <datalist id="known-entities">
        {KNOWN_ENTITIES.map((e) => (
          <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
        ))}
      </datalist>

      <div className="text-[10px] text-ink-mute">
        Entity is free text — type any custom name (e.g. <code className="mono">Ondine AI</code>) or pick a known one. Both will flow into the CPA export.
      </div>
    </div>
  );
}

function SplitRow({ split, onChange, onDelete }: {
  split: TransactionSplit;
  onChange: (patch: Partial<TransactionSplit>) => void;
  onDelete: () => void;
}) {
  const [amountStr, setAmountStr] = useState(centsToInputStr(split.amountCents));
  const [entity, setEntity] = useState(split.entity);
  const [individual, setIndividual] = useState(split.individual || '');
  const [sub1, setSub1] = useState(split.subCategory1 || '');
  const [purpose, setPurpose] = useState(split.businessPurpose || '');

  function commitAmount() {
    const c = parseDollarsToCents(amountStr);
    if (c != null && c !== split.amountCents) {
      onChange({ amountCents: c });
    }
  }

  return (
    <div className="rounded-md p-2 bg-bg-2 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
      <div className="md:col-span-2">
        <input
          type="text"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          onBlur={commitAmount}
          className="w-full text-xs"
        />
      </div>
      <div className="md:col-span-2">
        <input
          list="known-entities"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          onBlur={() => entity !== split.entity && onChange({ entity })}
          className="w-full text-xs"
        />
      </div>
      <div className="md:col-span-2">
        <input
          value={individual}
          onChange={(e) => setIndividual(e.target.value)}
          onBlur={() => onChange({ individual: individual || null })}
          className="w-full text-xs"
          placeholder="Individual"
        />
      </div>
      <div className="md:col-span-2">
        <input
          value={sub1}
          onChange={(e) => setSub1(e.target.value)}
          onBlur={() => onChange({ subCategory1: sub1 || null })}
          className="w-full text-xs"
          placeholder="Sub category"
        />
      </div>
      <div className="md:col-span-3">
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          onBlur={() => onChange({ businessPurpose: purpose || null })}
          className="w-full text-xs"
          placeholder="Business purpose"
        />
      </div>
      <div className="md:col-span-1 text-right">
        <button onClick={onDelete} className="btn btn-ghost !p-1.5 text-expense" title="Remove split"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}
