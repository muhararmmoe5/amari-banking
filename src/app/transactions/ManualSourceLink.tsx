'use client';

import { useEffect, useState } from 'react';
import { Loader2, Search, X, Link2, ArrowDownToLine } from 'lucide-react';
import { saveTransaction } from './actions';
import { useToast } from '@/components/Toast';
import { fmtMoney, fmtDate } from '@/lib/format';
import { getAccount } from '@/constants/accounts';

interface FundedBy {
  id: string;
  postingDate: string;
  description: string;
  merchant: string | null;
  amount: number;
  accountId: string;
}
interface SearchResult {
  id: string;
  postingDate: string;
  description: string;
  merchant: string | null;
  amount: number;
  accountId: string;
}

/** Replaces the FIFO source trace. Lets the user MANUALLY tag this expense
 *  to a specific inflow transaction. No assumptions. */
export default function ManualSourceLink({ txId, currentFundedById }: { txId: string; currentFundedById: string | null }) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [fundedBy, setFundedBy] = useState<FundedBy | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!currentFundedById) { setFundedBy(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/flow/manual?txId=${encodeURIComponent(txId)}`, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setFundedBy(d.fundedBy || null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [txId, currentFundedById]);

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

  async function link(inflowId: string | null) {
    const id = saveStart();
    try {
      await saveTransaction(txId, { fundedByTransactionId: inflowId } as any);
      saveEnd(id);
      if (inflowId) {
        // Fetch the linked inflow details so we render the chip without reload
        const r = await fetch(`/api/flow/manual?txId=${encodeURIComponent(txId)}`, { credentials: 'same-origin' });
        const d = await r.json();
        setFundedBy(d.fundedBy || null);
      } else {
        setFundedBy(null);
      }
      setPicking(false);
      setQuery('');
      setResults(null);
    } catch (e: any) {
      saveError(id, e?.message);
    }
  }

  if (loading) {
    return (
      <div className="text-2xs text-ink-mute inline-flex items-center gap-2">
        <Loader2 size={12} className="animate-spin" />
        Loading link…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fundedBy ? (
        <div className="card p-3.5 flex items-center gap-3" style={{ borderColor: 'rgba(127,184,146,0.30)' }}>
          <ArrowDownToLine size={14} className="text-income shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{fundedBy.merchant || fundedBy.description.slice(0, 80)}</div>
            <div className="text-2xs text-ink-mute mt-0.5">
              {fmtDate(fundedBy.postingDate)} · ···{fundedBy.accountId}{getAccount(fundedBy.accountId)?.label ? ` (${getAccount(fundedBy.accountId)?.label})` : ''}
            </div>
          </div>
          <div className="num text-income text-sm font-semibold shrink-0">{fmtMoney(fundedBy.amount)}</div>
          <button
            type="button"
            onClick={() => link(null)}
            className="text-ink-mute hover:text-expense text-xs"
            title="Unlink"
          >
            <X size={14} />
          </button>
        </div>
      ) : !picking ? (
        <div className="card p-4 flex items-center justify-between gap-3">
          <div className="text-2xs text-ink-mute">
            Not linked to a specific income transaction yet.
          </div>
          <button type="button" onClick={() => setPicking(true)} className="btn btn-sm">
            <Link2 size={12} /> Link to income
          </button>
        </div>
      ) : null}

      {picking ? (
        <div className="card p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <Search size={13} className="text-ink-mute" />
            <input
              type="text"
              autoFocus
              placeholder="search inflow merchant / description…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
              className="flex-1 !bg-transparent !border-0 !p-0 !text-sm !rounded-none focus:!shadow-none"
            />
            <button type="button" onClick={runSearch} className="btn btn-sm" disabled={searching}>
              {searching ? <Loader2 size={11} className="animate-spin" /> : 'Find'}
            </button>
            <button type="button" onClick={() => { setPicking(false); setResults(null); setQuery(''); }} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
          {results !== null ? (
            results.length === 0 ? (
              <div className="text-2xs text-ink-mute italic px-1">No matching inflows.</div>
            ) : (
              <div className="border border-line rounded-md max-h-72 overflow-y-auto divide-y divide-line/40">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => link(r.id)}
                    className="block w-full text-left px-3 py-2 hover:bg-bg-2 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{r.merchant || r.description.slice(0, 60)}</span>
                      <span className="num text-income text-sm font-medium shrink-0">{fmtMoney(r.amount)}</span>
                    </div>
                    <div className="text-2xs text-ink-mute mt-0.5">{fmtDate(r.postingDate)} · ···{r.accountId}</div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="text-2xs text-ink-mute italic px-1">
              Search by Spacetel, Stripe, the investor name, etc.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
