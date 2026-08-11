'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink, Sparkles } from 'lucide-react';
import type { Transaction, AuditStatus, EntityType } from '@/types';
import { ACCOUNTS, ENTITY_LABELS } from '@/constants/accounts';
import { Money } from '@/components/Money';
import { FlagBadge } from '@/components/FlagBadge';
import { EntityBadge } from '@/components/EntityBadge';
import { fmtDate } from '@/lib/format';
import { saveTransaction } from '../transactions/actions';
import { useToast } from '@/components/Toast';
import SplitEditor from './SplitEditor';

const ENTITY_OPTIONS: EntityType[] = [
  'BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES',
  'BYTES_REST_TECH', 'PERSONAL', 'MULTI_ENTITY', 'BUSINESS_SHARED', 'UNKNOWN',
];

export default function AuditClient({ initialRows }: { initialRows: Transaction[] }) {
  const [rows, setRows] = useState(initialRows);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError, toast } = useToast();
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const active = rows[activeIdx];

  // Scroll active into view
  useEffect(() => {
    const el = cardsRef.current[activeIdx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIdx]);

  function setStatus(tx: Transaction, status: AuditStatus) {
    const toastId = saveStart();
    startTx(async () => {
      try {
        await saveTransaction(tx.id, { auditStatus: status });
        saveEnd(toastId);
        setRows((cur) => cur.filter((r) => r.id !== tx.id));
        setActiveIdx((i) => Math.min(i, Math.max(0, rows.length - 2)));
      } catch (e: unknown) {
        saveError(toastId, e instanceof Error ? e.message : 'save failed');
      }
    });
  }

  function persistField(tx: Transaction, patch: Record<string, unknown>) {
    const toastId = saveStart();
    startTx(async () => {
      try {
        // saveTransaction is loosely typed on the server; the audit card only
        // sets known-safe keys so a Record<string, unknown> is fine here.
        await saveTransaction(tx.id, patch as never);
        saveEnd(toastId);
      } catch (e: unknown) {
        saveError(toastId, e instanceof Error ? e.message : 'save failed');
      }
    });
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      if (!active) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); setShowHelp((s) => !s); return; }
      if (e.key === 'Escape') { setShowHelp(false); return; }
      if (e.key === '1') { e.preventDefault(); setStatus(active, 'CONFIRMED'); }
      else if (e.key === '2') { e.preventDefault(); setStatus(active, 'NEEDS_RECEIPT'); }
      else if (e.key === '3') { e.preventDefault(); setStatus(active, 'PERSONAL_NO_DEDUCT'); }
      else if (e.key === '4') { e.preventDefault(); setActiveIdx((i) => Math.min(rows.length - 1, i + 1)); }
      else if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); setActiveIdx((i) => Math.min(rows.length - 1, i + 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, rows.length]);

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: 40, textAlign: 'center',
          border: '0.5px dashed rgba(255,255,255,0.08)', borderRadius: 12,
          color: 'var(--ink-3)',
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 6 }}>🎉</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>All clear in this bucket</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Adjust the filters above or head over to bulk-review.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-ink-dim mb-3 flex items-center justify-between">
        <div>
          Card <span className="text-ink mono">{Math.min(activeIdx + 1, rows.length)}</span> of <span className="mono">{rows.length}</span>
        </div>
        <button type="button" onClick={() => setShowHelp(true)} className="btn btn-ghost text-xs">
          <kbd>?</kbd> shortcuts
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {rows.map((tx, idx) => (
          <Card
            key={tx.id}
            tx={tx}
            isActive={idx === activeIdx}
            innerRef={(el) => { cardsRef.current[idx] = el; }}
            onClick={() => setActiveIdx(idx)}
            onStatus={(s) => setStatus(tx, s)}
            onPersist={(p) => persistField(tx, p)}
            onToast={(msg) => toast({ kind: 'ok', title: msg })}
          />
        ))}
      </div>

      {/* Sticky hint bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 card px-4 py-2 flex items-center gap-3 text-xs text-ink-dim">
        <span><kbd>1</kbd> Confirm</span>
        <span><kbd>2</kbd> Needs receipt</span>
        <span><kbd>3</kbd> Personal</span>
        <span><kbd>4</kbd> Skip</span>
        <span className="opacity-60">·</span>
        <span><kbd>←</kbd> <kbd>→</kbd> Navigate</span>
        <span className="opacity-60">·</span>
        <span><kbd>?</kbd> Help</span>
      </div>

      {showHelp ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="card p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Keyboard shortcuts</h3>
              <button onClick={() => setShowHelp(false)} className="btn btn-ghost">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div><kbd>1</kbd> Confirm ✅</div><div className="text-ink-dim">Mark CONFIRMED</div>
              <div><kbd>2</kbd> Needs receipt 🔴</div><div className="text-ink-dim">Flag for documentation</div>
              <div><kbd>3</kbd> Personal ❌</div><div className="text-ink-dim">Not deductible</div>
              <div><kbd>4</kbd> Skip ⏩</div><div className="text-ink-dim">Move on without tagging</div>
              <div><kbd>←</kbd> <kbd>→</kbd> / <kbd>j</kbd> <kbd>k</kbd></div><div className="text-ink-dim">Navigate cards</div>
              <div><kbd>?</kbd></div><div className="text-ink-dim">Toggle this help</div>
              <div><kbd>Esc</kbd></div><div className="text-ink-dim">Close / unfocus input</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Card({
  tx, isActive, innerRef, onClick, onStatus, onPersist, onToast,
}: {
  tx: Transaction;
  isActive: boolean;
  innerRef: (el: HTMLDivElement | null) => void;
  onClick: () => void;
  onStatus: (s: AuditStatus) => void;
  onPersist: (p: Record<string, unknown>) => void;
  onToast: (msg: string) => void;
}) {
  const [confirmedEntity, setConfirmedEntity] = useState<EntityType>(tx.confirmedEntity || tx.entityTag);
  const [category, setCategory] = useState<string>(String(tx.confirmedCategory || tx.category || ''));
  const [purpose, setPurpose] = useState(tx.businessPurpose || '');
  const [docRef, setDocRef] = useState(tx.receiptRef || '');
  const [individual, setIndividual] = useState(tx.individual || '');
  const [customTag, setCustomTag] = useState(tx.customSourceTag || '');
  const [claudeBusy, setClaudeBusy] = useState(false);
  const [claudeReasoning, setClaudeReasoning] = useState<string | null>(null);
  const acct = ACCOUNTS.find((a) => a.id === tx.accountId);

  const flagLabels = useMemo(
    () => tx.auditFlags.map((f) => f.replace(/_/g, ' ')),
    [tx.auditFlags],
  );

  async function askClaude() {
    setClaudeBusy(true);
    setClaudeReasoning(null);
    try {
      const res = await fetch('/api/admin/ai-classify-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: [{
            txId: tx.id,
            description: tx.description,
            amount: tx.amount,
            postingDate: tx.postingDate,
            accountId: tx.accountId,
            currentEntity: confirmedEntity,
            currentCategory: category,
            currentMerchant: tx.merchantName,
          }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || res.statusText);
      }
      const { suggestions } = (await res.json()) as {
        suggestions: Array<{
          entity: string | null; category: string | null; individual: string | null;
          customSourceTag: string | null; reasoning: string;
        }>;
      };
      const g = suggestions[0];
      if (!g) { onToast('Claude returned nothing — try again'); return; }
      if (g.entity && !tx.confirmedEntity) { setConfirmedEntity(g.entity as EntityType); onPersist({ confirmedEntity: g.entity }); }
      if (g.category && !tx.confirmedCategory) { setCategory(g.category); onPersist({ confirmedCategory: g.category }); }
      if (g.individual && !tx.individual) { setIndividual(g.individual); onPersist({ individual: g.individual }); }
      if (g.customSourceTag && !tx.customSourceTag) { setCustomTag(g.customSourceTag); onPersist({ customSourceTag: g.customSourceTag }); }
      setClaudeReasoning(g.reasoning);
      onToast('Claude filled in what it could');
    } catch (e) {
      setClaudeReasoning(`Failed: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setClaudeBusy(false);
    }
  }

  return (
    <div
      id={tx.id}
      ref={innerRef}
      onClick={onClick}
      className={`card p-5 space-y-4 cursor-pointer transition ${isActive ? 'ring-2 ring-entity-bytes border-entity-bytes/60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <FlagBadge score={tx.auditScore} />
          <span className="text-xs text-ink-mute mono">···{tx.accountId}</span>
          {acct ? <EntityBadge entity={acct.entity} size="xs" /> : null}
          <span className="text-xs text-ink-mute">{fmtDate(tx.postingDate)}</span>
        </div>
        <Money value={tx.amount} className="text-2xl" />
      </div>
      <div>
        <div className="font-medium">{tx.merchantName || tx.description.slice(0, 60)}</div>
        <div className="text-xs text-ink-mute mt-1 break-all">{tx.description}</div>
      </div>
      {flagLabels.length > 0 ? (
        <div className="text-xs space-y-1 text-warn">
          {flagLabels.map((f) => <div key={f}>⚠ {f}</div>)}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Entity</div>
          <select
            value={confirmedEntity}
            onChange={(e) => { const v = e.target.value as EntityType; setConfirmedEntity(v); onPersist({ confirmedEntity: v }); }}
            className="w-full"
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o} value={o}>{ENTITY_LABELS[o]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Category</div>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onBlur={() => onPersist({ confirmedCategory: category || null })}
            className="w-full"
            placeholder="e.g. SOFTWARE, HOUSING"
          />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Individual</div>
          <input
            type="text"
            value={individual}
            onChange={(e) => setIndividual(e.target.value)}
            onBlur={() => onPersist({ individual: individual || null })}
            className="w-full"
            placeholder="Person or vendor tied to this row"
          />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Doc reference</div>
          <input
            type="text"
            value={docRef}
            onChange={(e) => setDocRef(e.target.value)}
            onBlur={() => onPersist({ receiptRef: docRef || null })}
            className="w-full"
            placeholder="INV-1234 / link to file"
          />
        </label>
        <label className="block md:col-span-2">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">
            Custom source tag <span className="text-ink-mute normal-case tracking-normal">— specific client/project/purpose</span>
          </div>
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onBlur={() => onPersist({ customSourceTag: customTag || null })}
            className="w-full"
            placeholder={tx.amount > 0 ? 'e.g. Bytes AI — Client Acme, invoice #1234' : 'e.g. Anthropic API for Bytes AI production'}
          />
        </label>
        <label className="block md:col-span-2">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Business purpose</div>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            onBlur={() => onPersist({ businessPurpose: purpose || null })}
            className="w-full"
            placeholder="What was this transaction for?"
          />
        </label>
      </div>

      {claudeReasoning ? (
        <div
          style={{
            fontSize: 11, lineHeight: 1.45,
            padding: '8px 12px', borderRadius: 8,
            background: 'color-mix(in oklab, var(--gold) 6%, transparent)',
            border: '0.5px solid color-mix(in oklab, var(--gold) 20%, transparent)',
            color: 'var(--ink-2)',
          }}
        >
          <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>Claude:</em> {claudeReasoning}
        </div>
      ) : null}

      <SplitEditor transactionId={tx.id} transactionAmount={tx.amount} />

      <div className="flex flex-wrap gap-2 pt-2 border-t border-line" onClick={(e) => e.stopPropagation()}>
        <button className="btn btn-primary" onClick={() => onStatus('CONFIRMED')}>
          <kbd>1</kbd> ✅ Confirm
        </button>
        <button className="btn" onClick={() => onStatus('NEEDS_RECEIPT')}>
          <kbd>2</kbd> 🔴 Needs receipt
        </button>
        <button className="btn" onClick={() => onStatus('PERSONAL_NO_DEDUCT')}>
          <kbd>3</kbd> ❌ Personal
        </button>
        <button
          className="btn"
          onClick={askClaude}
          disabled={claudeBusy}
          style={{ color: 'var(--gold)', borderColor: 'color-mix(in oklab, var(--gold) 25%, rgba(255,255,255,0.08))' }}
        >
          <Sparkles size={12} /> {claudeBusy ? 'Asking…' : 'Ask Claude'}
        </button>
        <Link
          href={`/transactions/${tx.id}`}
          className="btn"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          Full detail <ExternalLink size={11} />
        </Link>
      </div>
    </div>
  );
}
