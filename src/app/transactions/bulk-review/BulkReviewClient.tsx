'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronRight, Sparkles, X } from 'lucide-react';
import type { BulkSuggestion } from '@/lib/db/bulk-suggest';
import { bulkApplyReviewsAction, type BulkApplyItem } from '../actions';
import { fmtMoney } from '@/lib/format';
import type { EntityType } from '@/types';

const CATEGORY_HINTS = [
  'INCOME', 'INCOME_SPACETEL', 'INCOME_STRIPE',
  'RENT', 'HOUSING', 'PAYROLL', 'SOFTWARE', 'MARKETING', 'TELECOM',
  'GROCERIES', 'TRANSPORTATION', 'HEALTH', 'ENTERTAINMENT',
  'COGS', 'OWNER_DRAW', 'INTERNAL_TRANSFER', 'FEE', 'UNCATEGORIZED',
];

interface Row extends BulkSuggestion {
  // Editable overrides (start = suggested).
  chosenEntity: string | null;
  chosenCategory: string | null;
  chosenIndividual: string | null;
  chosenCustomTag: string | null;
  chosenFundedBy: string | null;
  accepted: boolean;
  claudeReasoning?: string | null;
}

export default function BulkReviewClient({
  suggestions, entityOptions, totalTransactions = 0, alreadyReviewed = 0,
}: {
  suggestions: BulkSuggestion[];
  entityOptions: { value: EntityType; label: string }[];
  totalTransactions?: number;
  alreadyReviewed?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>(() =>
    suggestions.map((s) => ({
      ...s,
      chosenEntity: s.suggested.entity ?? s.current.entity,
      chosenCategory: s.suggested.category ?? s.current.category,
      chosenIndividual: s.current.individual,
      chosenCustomTag: s.current.customSourceTag,
      chosenFundedBy: s.suggested.fundedByTransactionId ?? s.current.fundedByTransactionId,
      // Auto-select high-confidence rows so the common case is "check totals, hit apply".
      accepted: s.confidence === 'high',
    })),
  );

  const [claudeBusy, setClaudeBusy] = useState(false);
  const [claudeMsg, setClaudeMsg] = useState<string | null>(null);

  async function askClaude() {
    setClaudeBusy(true);
    setClaudeMsg(null);
    try {
      // Batch in groups of 40 so the endpoint's per-call cap is respected.
      const BATCH = 40;
      const targets = rows;
      let filled = 0;
      for (let i = 0; i < targets.length; i += BATCH) {
        const batch = targets.slice(i, i + BATCH).map((r) => ({
          txId: r.txId,
          description: r.description,
          amount: r.amount,
          postingDate: r.postingDate,
          accountId: r.accountId,
          currentEntity: r.chosenEntity,
          currentCategory: r.chosenCategory,
          currentMerchant: r.current.merchantName,
        }));
        const res = await fetch('/api/admin/ai-classify-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: batch }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || err.error || res.statusText);
        }
        const { suggestions: got } = (await res.json()) as {
          suggestions: Array<{
            txId: string; entity: string | null; category: string | null;
            individual: string | null; customSourceTag: string | null;
            confidence: 'high' | 'medium' | 'low'; reasoning: string;
          }>;
        };
        const byId = new Map(got.map((g) => [g.txId, g]));
        setRows((prev) => prev.map((r) => {
          const g = byId.get(r.txId);
          if (!g) return r;
          filled++;
          return {
            ...r,
            chosenEntity: g.entity || r.chosenEntity,
            chosenCategory: g.category || r.chosenCategory,
            chosenIndividual: g.individual || r.chosenIndividual,
            chosenCustomTag: g.customSourceTag || r.chosenCustomTag,
            // Upgrade confidence if Claude was more confident than the rules.
            confidence: (g.confidence === 'high' || (g.confidence === 'medium' && r.confidence === 'low'))
              ? g.confidence
              : r.confidence,
            accepted: g.confidence === 'high' ? true : r.accepted,
            claudeReasoning: g.reasoning,
          };
        }));
      }
      setClaudeMsg(`Claude classified ${filled} row${filled === 1 ? '' : 's'}.`);
    } catch (e) {
      setClaudeMsg(`Claude failed: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setClaudeBusy(false);
    }
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const accepted = rows.filter((r) => r.accepted).length;
    const high = rows.filter((r) => r.confidence === 'high').length;
    const medium = rows.filter((r) => r.confidence === 'medium').length;
    const low = rows.filter((r) => r.confidence === 'low').length;
    return { total, accepted, high, medium, low };
  }, [rows]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.txId === id ? { ...r, ...patch } : r)));
  }
  function selectAll(v: boolean) { setRows((p) => p.map((r) => ({ ...r, accepted: v }))); }
  function selectConfidence(c: 'high' | 'medium' | 'low', v: boolean) {
    setRows((p) => p.map((r) => (r.confidence === c ? { ...r, accepted: v } : r)));
  }

  function applyAccepted() {
    const items: BulkApplyItem[] = rows
      .filter((r) => r.accepted)
      .map((r) => ({
        txId: r.txId,
        confirmedEntity: r.chosenEntity || null,
        confirmedCategory: r.chosenCategory || null,
        individual: r.chosenIndividual || null,
        customSourceTag: r.chosenCustomTag || null,
        fundedByTransactionId: r.chosenFundedBy || null,
        markReviewed: true,
      }));
    if (!items.length) { setMsg('Select at least one row to apply.'); return; }
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await bulkApplyReviewsAction(items);
        setMsg(`Applied ${res.updated}. ${res.skipped ? `${res.skipped} skipped.` : ''}`);
        // Give the toast a beat, then bounce back to the transactions list.
        setTimeout(() => router.push('/transactions'), 900);
      } catch (e) {
        setMsg(`Failed: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    });
  }

  const cellStyle: React.CSSProperties = {
    padding: '6px 8px', background: 'var(--bg-1, #111114)',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6,
    fontSize: 12, color: 'var(--ink)', outline: 'none', width: '100%',
  };

  return (
    <div className="page-pad-mobile" style={{ padding: '24px 24px 100px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/transactions" className="flex items-center" style={{ gap: 6, fontSize: 11, color: 'var(--ink-3)', textDecoration: 'none' }}>
          <ArrowLeft size={13} /> Back to transactions
        </Link>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6 }}>
            Banking / Transactions / Bulk auto-tag
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-.02em', color: 'var(--ink)' }}>
            <em style={{ fontFamily: 'var(--font-serif, "Instrument Serif", serif)', fontStyle: 'italic', color: 'var(--gold)', fontWeight: 400 }}>
              Preview
            </em>{' '}
            what Amari would tag — edit anything, then apply
          </h1>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
            {stats.total} unreviewed rows loaded. High-confidence ({stats.high}) are pre-selected. Medium ({stats.medium}) and low ({stats.low}) need a look.
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 5,
          padding: '12px 14px', marginBottom: 12,
          background: 'color-mix(in oklab, var(--bg-1, #111114) 92%, transparent)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          <b style={{ color: 'var(--gold)' }}>{stats.accepted}</b> of {stats.total} selected
        </div>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />
        <button type="button" onClick={() => selectAll(true)} className="btn btn-sm">All</button>
        <button type="button" onClick={() => selectAll(false)} className="btn btn-sm">None</button>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />
        <button type="button" onClick={() => selectConfidence('high', true)} className="btn btn-sm" style={{ color: 'var(--income)' }}>+ High ({stats.high})</button>
        <button type="button" onClick={() => selectConfidence('medium', true)} className="btn btn-sm" style={{ color: 'var(--gold)' }}>+ Medium ({stats.medium})</button>
        <button type="button" onClick={() => selectConfidence('low', true)} className="btn btn-sm" style={{ color: 'var(--ink-3)' }}>+ Low ({stats.low})</button>

        <div style={{ flex: 1 }} />

        {claudeMsg ? <div style={{ fontSize: 11, color: claudeMsg.startsWith('Claude failed') ? 'var(--danger, #ff7676)' : 'var(--gold)' }}>{claudeMsg}</div> : null}
        {msg ? <div style={{ fontSize: 11, color: msg.startsWith('Failed') ? 'var(--danger, #ff7676)' : 'var(--income)' }}>{msg}</div> : null}

        <button
          type="button"
          onClick={askClaude}
          disabled={claudeBusy || rows.length === 0}
          className="btn"
          style={{
            display: 'flex', gap: 6, alignItems: 'center',
            color: 'var(--gold)',
            borderColor: 'color-mix(in oklab, var(--gold) 30%, rgba(255,255,255,0.08))',
            opacity: (claudeBusy || rows.length === 0) ? 0.5 : 1,
          }}
        >
          <Sparkles size={13} /> {claudeBusy ? 'Asking Claude…' : 'Ask Claude'}
        </button>
        <button
          type="button"
          onClick={applyAccepted}
          disabled={isPending || stats.accepted === 0}
          className="btn btn-primary"
          style={{ display: 'flex', gap: 7, alignItems: 'center', opacity: (isPending || !stats.accepted) ? 0.5 : 1 }}
        >
          <Sparkles size={13} /> {isPending ? 'Applying…' : `Apply ${stats.accepted} tag${stats.accepted === 1 ? '' : 's'}`}
        </button>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, border: '0.5px dashed rgba(255,255,255,0.1)', borderRadius: 10 }}>
          {totalTransactions === 0 ? (
            <>
              <div style={{ fontSize: 26, marginBottom: 6 }}>📥</div>
              <div style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 6 }}>
                No transactions yet
              </div>
              <div style={{ marginBottom: 14, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
                Import a CSV from your bank or load the demo data to try this out.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <Link href="/import" className="btn btn-primary">Import CSV</Link>
                <Link href="/transactions" className="btn">Back to transactions</Link>
              </div>
            </>
          ) : alreadyReviewed >= totalTransactions ? (
            <>
              <div style={{ fontSize: 26, marginBottom: 6 }}>🎉</div>
              <div style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 6 }}>
                All caught up
              </div>
              <div style={{ marginBottom: 14 }}>
                Every one of your {totalTransactions.toLocaleString()} transactions is already reviewed.
              </div>
              <Link href="/transactions" className="btn btn-primary">Back to transactions</Link>
            </>
          ) : (
            <>
              <div style={{ fontSize: 26, marginBottom: 6 }}>🔍</div>
              <div style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 6 }}>
                Nothing in the pending queue right now
              </div>
              <div style={{ marginBottom: 14 }}>
                {alreadyReviewed.toLocaleString()} of {totalTransactions.toLocaleString()} transactions are marked reviewed.
              </div>
              <Link href="/transactions" className="btn">Back to transactions</Link>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => (
            <div
              key={r.txId}
              style={{
                padding: '12px 14px', borderRadius: 10,
                border: '1px solid ' + (r.accepted
                  ? 'color-mix(in oklab, var(--income) 25%, rgba(255,255,255,0.06))'
                  : 'rgba(255,255,255,0.06)'),
                background: r.accepted ? 'color-mix(in oklab, var(--income) 3%, var(--bg-1, #111114))' : 'var(--bg-1, #111114)',
                display: 'grid',
                gridTemplateColumns: '24px 220px 1fr auto',
                gap: 12, alignItems: 'start',
              }}
              className="bulk-row-grid"
            >
              {/* Accept checkbox */}
              <button
                type="button"
                onClick={() => updateRow(r.txId, { accepted: !r.accepted })}
                aria-label={r.accepted ? 'Deselect' : 'Select'}
                style={{
                  width: 20, height: 20, borderRadius: 5, marginTop: 2,
                  border: '1px solid ' + (r.accepted ? 'var(--income)' : 'rgba(255,255,255,0.15)'),
                  background: r.accepted ? 'var(--income)' : 'transparent',
                  color: r.accepted ? 'var(--bg-1, #111114)' : 'transparent',
                  display: 'grid', placeItems: 'center', cursor: 'pointer',
                }}
              >
                <Check size={13} strokeWidth={3} />
              </button>

              {/* Left: transaction identity */}
              <div style={{ minWidth: 0 }}>
                <div className="num" style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                  {r.postingDate} · ····{r.accountId}
                </div>
                <div className="truncate" style={{ fontSize: 12.5, color: 'var(--ink)', marginTop: 2 }}>
                  {r.suggested.merchantName || r.current.merchantName || r.description.slice(0, 40)}
                </div>
                <div className="num" style={{ fontSize: 12, color: r.amount < 0 ? 'var(--gold)' : 'var(--income)', marginTop: 3, fontWeight: 500 }}>
                  {fmtMoney(r.amount)}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <span
                    className="pill"
                    style={{
                      fontSize: 9.5, padding: '2px 8px', borderRadius: 999,
                      color: r.confidence === 'high' ? 'var(--income)' : r.confidence === 'medium' ? 'var(--gold)' : 'var(--ink-3)',
                      background: r.confidence === 'high'
                        ? 'color-mix(in oklab, var(--income) 12%, transparent)'
                        : r.confidence === 'medium'
                          ? 'color-mix(in oklab, var(--gold) 12%, transparent)'
                          : 'rgba(255,255,255,0.04)',
                      border: '1px solid ' + (r.confidence === 'high'
                        ? 'color-mix(in oklab, var(--income) 30%, transparent)'
                        : r.confidence === 'medium'
                          ? 'color-mix(in oklab, var(--gold) 30%, transparent)'
                          : 'rgba(255,255,255,0.08)'),
                    }}
                  >
                    {r.confidence.toUpperCase()}
                  </span>
                  {r.isInternal ? (
                    <span
                      className="pill"
                      style={{
                        fontSize: 9.5, padding: '2px 8px', borderRadius: 999,
                        color: 'var(--gold)',
                        background: 'color-mix(in oklab, var(--gold) 10%, transparent)',
                        border: '1px solid color-mix(in oklab, var(--gold) 25%, transparent)',
                      }}
                    >
                      INTERNAL ↔
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Middle: editable fields — collapses to 1-col on mobile */}
              <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, minWidth: 0 }}>
                <div>
                  <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-4, #44443f)', marginBottom: 3 }}>Entity</div>
                  <select
                    value={r.chosenEntity || ''}
                    onChange={(e) => updateRow(r.txId, { chosenEntity: e.target.value || null })}
                    style={cellStyle}
                  >
                    <option value="">— unset —</option>
                    {entityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-4, #44443f)', marginBottom: 3 }}>Category</div>
                  <input
                    list={`cat-${r.txId}`}
                    value={r.chosenCategory || ''}
                    onChange={(e) => updateRow(r.txId, { chosenCategory: e.target.value || null })}
                    style={cellStyle}
                  />
                  <datalist id={`cat-${r.txId}`}>
                    {CATEGORY_HINTS.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-4, #44443f)', marginBottom: 3 }}>Individual</div>
                  <input
                    type="text"
                    value={r.chosenIndividual || ''}
                    onChange={(e) => updateRow(r.txId, { chosenIndividual: e.target.value || null })}
                    placeholder="—"
                    style={cellStyle}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-4, #44443f)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Custom source tag
                    <span style={{ fontSize: 9, color: 'var(--ink-4, #44443f)', textTransform: 'none', letterSpacing: 0 }}>
                      — free text, e.g. &quot;Bytes AI — Client Acme, invoice #1234&quot;
                    </span>
                  </div>
                  <input
                    type="text"
                    value={r.chosenCustomTag || ''}
                    onChange={(e) => updateRow(r.txId, { chosenCustomTag: e.target.value || null })}
                    placeholder={r.amount > 0 ? 'What specifically is this income?' : 'What is this spend for?'}
                    style={cellStyle}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--ink-4, #44443f)', marginBottom: 3 }}>Funding source</div>
                  {r.suggested.fundedByLabel ? (
                    <div className="num" style={{ fontSize: 11, color: 'var(--ink-2)', padding: '5px 8px', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 6 }}>
                      {r.chosenFundedBy ? '✓ ' : '○ '}{r.suggested.fundedByLabel}
                      <button
                        type="button"
                        onClick={() => updateRow(r.txId, { chosenFundedBy: r.chosenFundedBy ? null : r.suggested.fundedByTransactionId })}
                        style={{ marginLeft: 8, fontSize: 10, color: 'var(--gold)', background: 'transparent', border: 0, cursor: 'pointer' }}
                      >
                        {r.chosenFundedBy ? '(remove)' : '(link)'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--ink-4, #44443f)', padding: '5px 8px' }}>
                      No source suggested — will fall back to FIFO trace at view time.
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: '1 / -1', fontSize: 10.5, color: 'var(--ink-3)', lineHeight: 1.45, marginTop: 2 }}>
                  <em style={{ fontStyle: 'italic', color: 'var(--ink-4, #44443f)' }}>Why:</em> {r.suggested.reason}
                </div>
                {r.claudeReasoning ? (
                  <div
                    style={{
                      gridColumn: '1 / -1', fontSize: 10.5, lineHeight: 1.45, marginTop: 2,
                      padding: '6px 10px', borderRadius: 6,
                      background: 'color-mix(in oklab, var(--gold) 6%, transparent)',
                      color: 'var(--ink-2)',
                      border: '0.5px solid color-mix(in oklab, var(--gold) 20%, transparent)',
                    }}
                  >
                    <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>Claude:</em> {r.claudeReasoning}
                  </div>
                ) : null}
              </div>

              {/* Right: link to detail */}
              <Link
                href={`/transactions/${r.txId}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 10.5, color: 'var(--ink-3)', textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 3, padding: '4px 6px',
                }}
                title="Open full detail in new tab"
              >
                Detail <ChevronRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Sticky bottom apply bar (mobile-friendly duplicate of the top bar) */}
      {rows.length > 0 ? (
        <div
          style={{
            position: 'sticky', bottom: 12, marginTop: 20, padding: '10px 14px',
            background: 'color-mix(in oklab, var(--bg-1, #111114) 94%, transparent)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
            display: 'flex', gap: 8, alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', flex: 1 }}>
            <b style={{ color: 'var(--gold)' }}>{stats.accepted}</b> of {stats.total} selected
          </div>
          <Link href="/transactions" className="btn btn-sm" style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <X size={12} /> Cancel
          </Link>
          <button
            type="button"
            onClick={applyAccepted}
            disabled={isPending || stats.accepted === 0}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', gap: 5, alignItems: 'center', opacity: (isPending || !stats.accepted) ? 0.5 : 1 }}
          >
            <Sparkles size={12} /> {isPending ? 'Applying…' : `Apply ${stats.accepted}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
