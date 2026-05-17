'use client';

import { useState, useTransition } from 'react';
import { Trash2, Plus, Sparkles } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { fmtCents } from '@/lib/cap';
import { fmtDate } from '@/lib/format';
import type { EntityType } from '@/types';
import type { Person } from '@/types/cap';
import {
  actSeedOmarBytesDeal, actDeleteCommitment, actCreateCommitment, actUpdateCommitmentStatus,
} from '../actions';

export interface CommitmentRow {
  id: string;
  personId: string;
  totalAmountCents: number;
  monthlyAmountCents: number | null;
  equityPercent: number | null;
  startDate: string | null;
  status: 'ACTIVE' | 'COMPLETE' | 'CANCELED';
  fundedCents: number;
  remainingCents: number;
  pctFunded: number;
  linkedTxCount: number;
  notes: string | null;
}

export default function CommitmentsPanel({
  entity, people, commitments,
}: { entity: EntityType; people: Person[]; commitments: CommitmentRow[] }) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [, startTx] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  const peopleById = new Map(people.map((p) => [p.id, p]));
  const showSeed = entity === 'BYTES_AI' && !commitments.some((c) => /omar/i.test(peopleById.get(c.personId)?.name || ''));

  function onSeed() {
    const id = saveStart();
    startTx(async () => {
      try {
        const r = await actSeedOmarBytesDeal();
        saveEnd(id);
        alert(`Recorded Omar's $900k → Bytes AI deal.\n20% equity holding created.\n${r.autoLinked} existing Spacetel/Omar inflows auto-linked to this commitment.`);
      } catch (e: any) { saveError(id, e?.message || 'failed'); }
    });
  }

  function onDelete(id: string) {
    if (!confirm('Delete this commitment? Linked transactions will be unlinked but kept.')) return;
    const tid = saveStart();
    startTx(async () => {
      try { await actDeleteCommitment(id); saveEnd(tid); } catch (e: any) { saveError(tid, e?.message || 'failed'); }
    });
  }

  function onMarkComplete(id: string) {
    const tid = saveStart();
    startTx(async () => {
      try { await actUpdateCommitmentStatus(id, 'COMPLETE'); saveEnd(tid); } catch (e: any) { saveError(tid, e?.message || 'failed'); }
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-dim">Funding commitments</h2>
        <div className="flex items-center gap-2">
          {showSeed ? (
            <button type="button" onClick={onSeed} className="btn btn-ghost text-xs inline-flex items-center gap-1">
              <Sparkles size={12} /> Quick-add: Omar $900k / 20%
            </button>
          ) : null}
          <button type="button" onClick={() => setAddOpen((v) => !v)} className="btn btn-ghost text-xs inline-flex items-center gap-1">
            <Plus size={12} /> Add commitment
          </button>
        </div>
      </div>

      {addOpen ? <AddForm entity={entity} people={people} onDone={() => setAddOpen(false)} /> : null}

      {commitments.length === 0 ? (
        <div className="card p-6 text-sm text-ink-dim">
          No funding commitments recorded for this entity. A commitment captures pledged investment money (e.g. "$900k for 20%, paid $75k/month") so we can track how much has been wired vs. still owed.
        </div>
      ) : (
        <div className="space-y-3">
          {commitments.map((c) => {
            const person = peopleById.get(c.personId);
            return (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-medium">
                      {person?.name || 'Unknown person'}
                      {c.equityPercent != null ? (
                        <span className="ml-2 pill text-[10px] bg-entity-bytes/10 text-entity-bytes border border-entity-bytes/30">
                          {c.equityPercent}% equity
                        </span>
                      ) : null}
                      <span className={`ml-2 pill text-[10px] ${
                        c.status === 'ACTIVE' ? 'bg-income/10 text-income border border-income/30'
                        : c.status === 'COMPLETE' ? 'bg-ink-mute/10 text-ink-mute border border-ink-mute/30'
                        : 'bg-flag-critBg/30 text-flag-critText border border-flag-critText/30'
                      }`}>{c.status.toLowerCase()}</span>
                    </div>
                    <div className="text-[11px] text-ink-mute mt-1">
                      {fmtCents(c.totalAmountCents)} total
                      {c.monthlyAmountCents ? ` · ${fmtCents(c.monthlyAmountCents)}/month` : ''}
                      {c.startDate ? ` · started ${fmtDate(c.startDate)}` : ''}
                    </div>
                    {c.notes ? <div className="text-[11px] text-ink-dim mt-1">{c.notes}</div> : null}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-ink-mute">Funded so far</div>
                    <div className="mono tabnum text-income text-lg">{fmtCents(c.fundedCents)}</div>
                    <div className="text-[10px] text-ink-mute">{c.pctFunded.toFixed(1)}% · {c.linkedTxCount} wires</div>
                  </div>
                </div>

                <div className="mt-3 h-2 bg-bg-2 rounded overflow-hidden">
                  <div className="h-full bg-income" style={{ width: `${Math.min(100, c.pctFunded)}%` }} />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <div className="text-ink-mute">Remaining: <span className="mono tabnum text-warn">{fmtCents(c.remainingCents)}</span></div>
                  <div className="flex items-center gap-3">
                    {c.status === 'ACTIVE' && c.remainingCents <= 0 ? (
                      <button type="button" onClick={() => onMarkComplete(c.id)} className="text-income hover:underline">
                        ✓ Mark complete
                      </button>
                    ) : null}
                    <button type="button" onClick={() => onDelete(c.id)} className="text-flag-critText hover:underline inline-flex items-center gap-1">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AddForm({ entity, people, onDone }: { entity: EntityType; people: Person[]; onDone: () => void }) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [, startTx] = useTransition();
  const [personId, setPersonId] = useState(people[0]?.id || '');
  const [total, setTotal] = useState('');
  const [monthly, setMonthly] = useState('');
  const [pct, setPct] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  function dollarsToCents(s: string): number {
    const n = Number(String(s).replace(/[^0-9.\-]/g, ''));
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tid = saveStart();
    if (!personId) return saveError(tid, 'Pick a person');
    const totalCents = dollarsToCents(total);
    if (totalCents <= 0) return saveError(tid, 'Total amount must be > 0');
    const monthlyCents = monthly ? dollarsToCents(monthly) : null;
    const pctNum = pct ? Number(pct) : null;
    startTx(async () => {
      try {
        await actCreateCommitment({
          entity,
          personId,
          totalAmountCents: totalCents,
          monthlyAmountCents: monthlyCents,
          equityPercent: pctNum,
          startDate,
          notes: notes || null,
        });
        saveEnd(tid);
        onDone();
      } catch (err: any) { saveError(tid, err?.message || 'failed'); }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card p-4 space-y-3 mb-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Investor / committer</div>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="w-full">
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Equity % (optional)</div>
          <input type="number" step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="20" className="w-full" />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Total committed ($)</div>
          <input value={total} onChange={(e) => setTotal(e.target.value)} placeholder="900000" className="w-full" />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Monthly tranche ($, optional)</div>
          <input value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="75000" className="w-full" />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Start date</div>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
        </label>
      </div>
      <label className="block">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Notes</div>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How the funds will arrive…" className="w-full" />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn">Cancel</button>
        <button type="submit" className="btn btn-primary">Save commitment</button>
      </div>
    </form>
  );
}
