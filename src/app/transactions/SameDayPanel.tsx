'use client';

import { useEffect, useState, useTransition } from 'react';
import { CalendarDays, Check, Loader2 } from 'lucide-react';
import { ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import type { EntityType } from '@/types';
import { fmtMoney } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { bulkApplyTagsAction } from './actions';

interface SameDayTx {
  id: string;
  description: string;
  merchant: string | null;
  amount: number;
  category: string;
  auditStatus: string;
  confirmedEntity: string | null;
  entityTag: string;
}

interface CurrentTags {
  confirmedEntity?: string | null;
  subCategory1?: string | null;
  subCategory2?: string | null;
  individual?: string | null;
  sourceOfMoney?: string | null;
  needToGetFrom?: string | null;
  businessPurpose?: string | null;
  taggedDate?: string | null;
  cpaReviewed?: boolean;
}

interface Props {
  txId: string;
  postingDate: string;
  accountId: string;
  currentTags: CurrentTags;
}

const APPLIABLE_FIELDS: { key: keyof CurrentTags; label: string }[] = [
  { key: 'confirmedEntity', label: 'Books to entity' },
  { key: 'subCategory1', label: 'Sub category 1' },
  { key: 'subCategory2', label: 'Sub category 2' },
  { key: 'individual', label: 'Individual' },
  { key: 'sourceOfMoney', label: 'Source of money' },
  { key: 'needToGetFrom', label: 'Need to get from' },
  { key: 'businessPurpose', label: 'Business purpose' },
  { key: 'taggedDate', label: 'Tagged date' },
  { key: 'cpaReviewed', label: 'CPA reviewed status' },
];

export default function SameDayPanel({ txId, postingDate, accountId, currentTags }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SameDayTx[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fields, setFields] = useState<Set<keyof CurrentTags>>(new Set(['confirmedEntity', 'subCategory1', 'businessPurpose', 'taggedDate']));
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError, toast } = useToast();

  useEffect(() => {
    if (open && rows == null) {
      setLoading(true);
      fetch(`/api/flow/same-day?txId=${encodeURIComponent(txId)}`, { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((d) => setRows(d.rows || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }
  }, [open, rows, txId]);

  function toggleRow(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!rows) return;
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleField(k: keyof CurrentTags) {
    setFields((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function apply() {
    if (selected.size === 0) { toast({ kind: 'err', title: 'Pick at least one transaction' }); return; }
    if (fields.size === 0) { toast({ kind: 'err', title: 'Pick at least one field to copy' }); return; }
    const patch: any = {};
    for (const key of fields) {
      // Only include keys that have a defined value in the current tags
      const v = currentTags[key];
      if (v === undefined) continue;
      patch[key] = v ?? null;
    }
    if (Object.keys(patch).length === 0) {
      toast({ kind: 'err', title: 'Current transaction has no values for those fields' });
      return;
    }
    const tId = saveStart();
    startTx(async () => {
      try {
        const res = await bulkApplyTagsAction(Array.from(selected), patch);
        saveEnd(tId);
        toast({ kind: 'ok', title: `Applied to ${res.updated} transactions` });
        setSelected(new Set());
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
          <CalendarDays size={12} /> Apply these tags to other same-day transactions on ···{accountId}
        </button>
      </div>
    );
  }

  return (
    <div className="pt-3 border-t border-line/60 space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-ink-mute inline-flex items-center gap-1.5">
        <CalendarDays size={12} />
        Same-day transactions on ···{accountId} · {postingDate}
      </div>

      {/* Field selector */}
      <div className="rounded-md p-2 bg-bg-2 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-ink-mute">Fields to copy from this transaction</div>
        <div className="flex flex-wrap gap-2">
          {APPLIABLE_FIELDS.map((f) => {
            const v = currentTags[f.key];
            const has = v !== undefined && v !== null && v !== '';
            return (
              <label key={f.key} className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border cursor-pointer ${
                fields.has(f.key) ? 'bg-entity-bytes/15 border-entity-bytes/40 text-ink' : 'bg-bg-3 border-line text-ink-dim'
              } ${!has ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  className="accent-entity-bytes"
                  checked={fields.has(f.key)}
                  disabled={!has}
                  onChange={() => toggleField(f.key)}
                />
                {f.label}
              </label>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      {loading ? (
        <div className="text-xs text-ink-mute inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      ) : !rows || rows.length === 0 ? (
        <div className="text-xs text-ink-mute py-3">No other transactions on this account for this date.</div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={selectAll} className="text-entity-bytes hover:underline">
              {selected.size === rows.length ? 'Clear all' : `Select all (${rows.length})`}
            </button>
            <span className="text-ink-mute">{selected.size} selected</span>
          </div>
          <div className="rounded-md border border-line max-h-56 overflow-y-auto divide-y divide-line/60">
            {rows.map((r) => {
              const ent = (r.confirmedEntity || r.entityTag) as EntityType;
              const color = ENTITY_COLORS[ent] || '#888';
              return (
                <label key={r.id} className="grid grid-cols-[20px_1fr_auto] gap-2 items-center px-2 py-1.5 text-xs cursor-pointer hover:bg-bg-2/40">
                  <input
                    type="checkbox"
                    className="accent-entity-bytes"
                    checked={selected.has(r.id)}
                    onChange={() => toggleRow(r.id)}
                  />
                  <div className="min-w-0">
                    <div className="truncate">{r.merchant || r.description.slice(0, 70)}</div>
                    <div className="flex items-center gap-2 text-[10px] text-ink-mute">
                      <span className="pill" style={{ background: `${color}1f`, color, border: `1px solid ${color}40` }}>
                        {ENTITY_LABELS[ent] || ent}
                      </span>
                      <span>{r.auditStatus.replace(/_/g, ' ').toLowerCase()}</span>
                    </div>
                  </div>
                  <div className={`mono tabnum text-xs ${r.amount >= 0 ? 'text-income' : 'text-expense'}`}>{fmtMoney(r.amount)}</div>
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setSelected(new Set()); }} className="btn btn-ghost text-xs">Close</button>
            <button type="button" onClick={apply} className="btn btn-primary text-xs">
              <Check size={12} /> Apply to {selected.size} selected
            </button>
          </div>
        </>
      )}
    </div>
  );
}
