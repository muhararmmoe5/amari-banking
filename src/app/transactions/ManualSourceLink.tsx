'use client';

import { useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import { Loader2, Search, X, Plus, ArrowDownToLine, AlertCircle, Sparkles } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { fmtMoney, fmtDate } from '@/lib/format';
import { getAccount } from '@/constants/accounts';

interface Split {
  id: string;
  sourceTxId: string | null;
  sourceLabel: string | null;
  amountCents: number;
  notes: string | null;
  fromAI?: boolean;
  sourceTx?: {
    postingDate: string;
    description: string;
    merchant: string | null;
    amount: number;
    accountId: string;
  } | null;
}

export interface ManualSourceLinkHandle {
  reload: () => Promise<void>;
}
interface SearchResult {
  id: string;
  postingDate: string;
  description: string;
  merchant: string | null;
  amount: number;
  accountId: string;
}

const FREE_LABELS = [
  'Personal money',
  'Pre-import balance',
  'Credit card float',
  'Loan / other',
];

/** Manual funding split UI: tag this expense to one OR MORE income sources,
 *  each with its own dollar amount. No FIFO assumption. */
const ManualSourceLink = forwardRef<ManualSourceLinkHandle, {
  txId: string;
  expenseAmount: number;
}>(function ManualSourceLink({ txId, expenseAmount }, ref) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [splits, setSplits] = useState<Split[] | null>(null);
  const [adding, setAdding] = useState(false);

  // Add-form state
  const [mode, setMode] = useState<'inflow' | 'label'>('inflow');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pickedInflow, setPickedInflow] = useState<SearchResult | null>(null);
  const [labelChoice, setLabelChoice] = useState<string>(FREE_LABELS[0]);
  const [amountStr, setAmountStr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  async function load() {
    try {
      const r = await fetch(`/api/flow/splits?expenseTxId=${encodeURIComponent(txId)}`, { credentials: 'same-origin' });
      const d = await r.json();
      setSplits(d.splits || []);
    } catch {
      setSplits([]);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [txId]);

  useImperativeHandle(ref, () => ({ reload: load }), [txId]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAllocatedCents = (splits || []).reduce((s, x) => s + x.amountCents, 0);
  const expenseCents = Math.round(Math.abs(expenseAmount) * 100);
  const unallocatedCents = expenseCents - totalAllocatedCents;

  async function runSearch() {
    setSearching(true);
    try {
      const r = await fetch(`/api/transactions/search?inflowOnly=1&q=${encodeURIComponent(query)}&limit=20`, { credentials: 'same-origin' });
      const d = await r.json();
      setResults(d.transactions || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function resetForm() {
    setAdding(false);
    setMode('inflow');
    setQuery('');
    setResults(null);
    setPickedInflow(null);
    setLabelChoice(FREE_LABELS[0]);
    setAmountStr('');
    setNotes('');
  }

  async function save() {
    const amount = Number(amountStr.replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      saveError(saveStart(), 'Enter a valid amount');
      return;
    }
    const id = saveStart();
    try {
      const body =
        mode === 'inflow'
          ? { expenseTxId: txId, sourceTxId: pickedInflow?.id, amount, notes: notes || null }
          : { expenseTxId: txId, sourceLabel: labelChoice, amount, notes: notes || null };
      if (mode === 'inflow' && !pickedInflow?.id) {
        saveError(id, 'Pick an inflow first');
        return;
      }
      const r = await fetch('/api/flow/splits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || `http_${r.status}`);
      }
      saveEnd(id);
      resetForm();
      load();
    } catch (e: any) {
      saveError(id, e?.message || 'failed');
    }
  }

  async function remove(splitId: string) {
    if (!confirm('Remove this source?')) return;
    const id = saveStart();
    try {
      await fetch(`/api/flow/splits?id=${encodeURIComponent(splitId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      saveEnd(id);
      load();
    } catch (e: any) {
      saveError(id, e?.message || 'failed');
    }
  }

  if (splits === null) {
    return (
      <div className="text-2xs text-ink-mute inline-flex items-center gap-2">
        <Loader2 size={12} className="animate-spin" />
        Loading splits…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Existing splits */}
      {splits.length > 0 ? (
        <div className="card divide-y divide-line/40 overflow-hidden">
          {splits.map((s) => {
            const src = s.sourceTx;
            const isInflow = !!s.sourceTxId && src;
            return (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <ArrowDownToLine size={14} className="text-income shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    <span className="truncate">
                      {isInflow
                        ? (src!.merchant || src!.description.slice(0, 60))
                        : (s.sourceLabel || 'Untagged source')}
                    </span>
                    {s.fromAI ? (
                      <span
                        className="pill inline-flex items-center gap-1 shrink-0"
                        style={{
                          fontSize: 9.5,
                          padding: '1px 6px',
                          color: 'var(--gold)',
                          borderColor: 'rgba(201,168,122,0.30)',
                          background: 'rgba(201,168,122,0.10)',
                        }}
                      >
                        <Sparkles size={8} /> AI · override
                      </span>
                    ) : null}
                  </div>
                  <div className="text-2xs text-ink-mute mt-0.5">
                    {isInflow ? (
                      <>
                        {fmtDate(src!.postingDate)} · ···{src!.accountId}{getAccount(src!.accountId)?.label ? ` (${getAccount(src!.accountId)?.label})` : ''} · originally {fmtMoney(src!.amount)}
                      </>
                    ) : (
                      'manual entry'
                    )}
                    {s.notes ? <> · {s.notes}</> : null}
                  </div>
                </div>
                <div className="num text-income text-sm font-semibold shrink-0">
                  {fmtMoney(s.amountCents / 100)}
                </div>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="text-ink-mute hover:text-expense"
                  title="Remove split"
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Allocation summary — uses "split" only when there are 2+ sources */}
      {splits.length > 0 || adding ? (
        <div className="flex items-center justify-between text-2xs px-1">
          <div className="text-ink-mute">
            {splits.length > 1 ? 'Split · ' : ''}
            <span className="num text-income">{fmtMoney(totalAllocatedCents / 100)}</span> of <span className="num">{fmtMoney(expenseCents / 100)}</span>
            {splits.length === 1 ? ' tagged' : ''}
          </div>
          <div className={unallocatedCents > 1 ? 'text-warn' : unallocatedCents < -1 ? 'text-expense' : 'text-income'}>
            {unallocatedCents > 1 && <>{fmtMoney(unallocatedCents / 100)} unallocated</>}
            {unallocatedCents < -1 && <>{fmtMoney(Math.abs(unallocatedCents) / 100)} over</>}
            {Math.abs(unallocatedCents) <= 1 && '✓ fully allocated'}
          </div>
        </div>
      ) : null}

      {/* Add new source manually */}
      {!adding ? (
        <div className="flex items-center justify-between gap-3">
          {splits.length === 0 ? (
            <div className="text-2xs text-ink-mute">
              Not tagged to any income yet. Use AI above or add a source manually.
            </div>
          ) : <div />}
          <button type="button" onClick={() => setAdding(true)} className="btn btn-sm">
            <Plus size={12} /> Add manually
          </button>
        </div>
      ) : (
        <div className="card p-3.5 space-y-3">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('inflow')}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                mode === 'inflow'
                  ? 'bg-accent/15 border-accent/40 text-ink'
                  : 'bg-bg-2 border-line text-ink-dim hover:bg-bg-3'
              }`}
              style={mode === 'inflow' ? { background: 'rgba(201,168,122,0.15)', borderColor: 'rgba(201,168,122,0.4)' } : undefined}
            >
              From a specific income wire
            </button>
            <button
              type="button"
              onClick={() => setMode('label')}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                mode === 'label'
                  ? 'bg-accent/15 border-accent/40 text-ink'
                  : 'bg-bg-2 border-line text-ink-dim hover:bg-bg-3'
              }`}
              style={mode === 'label' ? { background: 'rgba(201,168,122,0.15)', borderColor: 'rgba(201,168,122,0.4)' } : undefined}
            >
              Personal / other source
            </button>
          </div>

          {/* Source picker */}
          {mode === 'inflow' ? (
            pickedInflow ? (
              <div className="bg-bg-2 border border-line rounded-md p-2.5 flex items-center gap-2">
                <ArrowDownToLine size={12} className="text-income shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{pickedInflow.merchant || pickedInflow.description.slice(0, 50)}</div>
                  <div className="text-2xs text-ink-mute mt-0.5">
                    {fmtDate(pickedInflow.postingDate)} · ···{pickedInflow.accountId} · originally {fmtMoney(pickedInflow.amount)}
                  </div>
                </div>
                <button type="button" onClick={() => setPickedInflow(null)} className="text-ink-mute hover:text-expense"><X size={12} /></button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Search size={13} className="text-ink-mute" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="search income (Spacetel, Stripe, investor name…)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
                    className="flex-1 !bg-transparent !border-0 !p-0 !text-sm !rounded-none focus:!shadow-none"
                  />
                  <button type="button" onClick={runSearch} className="btn btn-sm" disabled={searching}>
                    {searching ? <Loader2 size={11} className="animate-spin" /> : 'Find'}
                  </button>
                </div>
                {results !== null ? (
                  results.length === 0 ? (
                    <div className="text-2xs text-ink-mute italic">No matching inflows.</div>
                  ) : (
                    <div className="border border-line rounded-md max-h-48 overflow-y-auto divide-y divide-line/40">
                      {results.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { setPickedInflow(r); setResults(null); setQuery(''); }}
                          className="block w-full text-left px-3 py-2 hover:bg-bg-2 transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm truncate">{r.merchant || r.description.slice(0, 50)}</span>
                            <span className="num text-income text-sm">{fmtMoney(r.amount)}</span>
                          </div>
                          <div className="text-2xs text-ink-mute mt-0.5">{fmtDate(r.postingDate)} · ···{r.accountId}</div>
                        </button>
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            )
          ) : (
            <select value={labelChoice} onChange={(e) => setLabelChoice(e.target.value)} className="w-full">
              {FREE_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}

          {/* Amount + notes */}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder="amount, e.g. 3000"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="!text-sm"
            />
            <input
              type="text"
              placeholder="notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="!text-sm"
            />
          </div>

          {unallocatedCents > 0 && (
            <button
              type="button"
              onClick={() => setAmountStr((unallocatedCents / 100).toFixed(2))}
              className="text-2xs text-ink-mute hover:text-accent transition inline-flex items-center gap-1"
              style={{ color: amountStr ? undefined : '#c9a87a' }}
            >
              <AlertCircle size={10} /> Use full remaining ({fmtMoney(unallocatedCents / 100)})
            </button>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={resetForm} className="btn btn-sm btn-ghost">Cancel</button>
            <button type="button" onClick={save} className="btn btn-sm btn-primary">Save source</button>
          </div>
        </div>
      )}
    </div>
  );
});

export default ManualSourceLink;
