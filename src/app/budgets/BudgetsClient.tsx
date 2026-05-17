'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Archive } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { fmtCents } from '@/lib/cap';
import type { EntityType } from '@/types';
import type { BudgetWithSpend, BudgetKind } from '@/lib/db/budgets';
import { actCreateBudget, actUpdateBudget, actDeleteBudget } from './actions';

const ENTITY_OPTIONS: { v: EntityType | ''; l: string }[] = [
  { v: '', l: 'Any / unspecified' },
  { v: 'BYTES_AI', l: 'Bytes AI' },
  { v: 'ROCKET_WIRELESS', l: 'Rocket Wireless' },
  { v: 'DELICIOUS_BYTES', l: 'Delicious Bytes LLC' },
  { v: 'AMARI_VENTURES', l: 'Amari Ventures' },
  { v: 'BYTES_REST_TECH', l: 'Bytes Restaurant Tech' },
  { v: 'PERSONAL', l: 'Personal' },
];

function dollarsToCents(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s.replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

interface CommitmentOption {
  id: string;
  label: string;
  entity: string;
  monthlyAmountCents: number | null;
}

export default function BudgetsClient({ initial, commitments }: { initial: BudgetWithSpend[]; commitments: CommitmentOption[] }) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [, startTx] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  function onCreate(form: FormData) {
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    const tid = saveStart();
    startTx(async () => {
      try {
        await actCreateBudget({
          name,
          entity: (form.get('entity') as EntityType) || null,
          kind: (form.get('kind') as BudgetKind) || 'EXPENSE',
          monthlyAmountCents: dollarsToCents(String(form.get('monthly') || '')),
          periodMonth: (form.get('periodMonth') as string) || null,
          fundingCommitmentId: (form.get('commitmentId') as string) || null,
          notes: (form.get('notes') as string) || null,
        });
        saveEnd(tid);
        setAddOpen(false);
      } catch (e: any) { saveError(tid, e?.message || 'failed'); }
    });
  }

  function onArchive(id: string, archive: boolean) {
    const tid = saveStart();
    startTx(async () => {
      try { await actUpdateBudget(id, { status: archive ? 'ARCHIVED' : 'ACTIVE' }); saveEnd(tid); }
      catch (e: any) { saveError(tid, e?.message || 'failed'); }
    });
  }

  function onDelete(id: string) {
    if (!confirm('Delete this budget? Tagged transactions will be untagged but kept.')) return;
    const tid = saveStart();
    startTx(async () => {
      try { await actDeleteBudget(id); saveEnd(tid); }
      catch (e: any) { saveError(tid, e?.message || 'failed'); }
    });
  }

  const active = initial.filter((b) => b.status === 'ACTIVE');
  const archived = initial.filter((b) => b.status === 'ARCHIVED');

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button type="button" onClick={() => setAddOpen((v) => !v)} className="btn btn-primary inline-flex items-center gap-1">
          <Plus size={14} /> New budget
        </button>
      </div>

      {addOpen ? (
        <form action={onCreate} className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Name *</div>
              <input name="name" required placeholder="e.g. Bytes AI Marketing" className="w-full" />
            </label>
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Kind</div>
              <select name="kind" defaultValue="EXPENSE" className="w-full">
                <option value="EXPENSE">Expense budget (money going out)</option>
                <option value="INCOME">Income target (money coming in)</option>
              </select>
            </label>
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Entity (optional)</div>
              <select name="entity" defaultValue="" className="w-full">
                {ENTITY_OPTIONS.map((o) => <option key={o.v || 'any'} value={o.v}>{o.l}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Monthly cap ($, optional)</div>
              <input name="monthly" placeholder="5000" className="w-full" />
            </label>
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Specific month (optional)</div>
              <input name="periodMonth" type="month" className="w-full" />
              <div className="text-[10px] text-ink-mute mt-1">Leave blank for ongoing. Set to scope this budget to one month (e.g. &ldquo;May 2026&rdquo;).</div>
            </label>
            <label className="block col-span-2">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Link to investor commitment (optional)</div>
              <select name="commitmentId" defaultValue="" className="w-full">
                <option value="">— not linked to an investment —</option>
                {commitments.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <div className="text-[10px] text-ink-mute mt-1">When linked, tagging a transaction to this budget also counts it toward the commitment&apos;s overall funding progress. Manage commitments on the Cap Table page for each entity.</div>
            </label>
            <label className="block col-span-2">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Notes</div>
              <input name="notes" placeholder="What does this cover?" className="w-full" />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="btn">Cancel</button>
            <button type="submit" className="btn btn-primary">Create</button>
          </div>
        </form>
      ) : null}

      <BudgetList title="Active" budgets={active} onArchive={onArchive} onDelete={onDelete} />
      {archived.length > 0 ? (
        <BudgetList title="Archived" budgets={archived} onArchive={onArchive} onDelete={onDelete} archived />
      ) : null}
    </div>
  );
}

function BudgetList({
  title, budgets, onArchive, onDelete, archived,
}: {
  title: string;
  budgets: BudgetWithSpend[];
  onArchive: (id: string, archive: boolean) => void;
  onDelete: (id: string) => void;
  archived?: boolean;
}) {
  if (budgets.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-dim mb-2">{title}</h2>
        <div className="card p-6 text-sm text-ink-dim">No budgets yet.</div>
      </section>
    );
  }
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider text-ink-dim mb-2">{title}</h2>
      <div className="card divide-y divide-line/60 overflow-hidden">
        {budgets.map((b) => {
          const cap = b.monthlyAmountCents;
          const pct = cap && cap > 0 ? (b.spentThisMonthCents / cap) * 100 : 0;
          return (
            <div key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-medium">
                    {b.name}
                    <span className={`ml-2 pill text-[10px] ${b.kind === 'EXPENSE' ? 'bg-expense/10 text-expense border border-expense/30' : 'bg-income/10 text-income border border-income/30'}`}>{b.kind === 'EXPENSE' ? 'expense' : 'income'}</span>
                    {b.entity ? <span className="ml-2 pill text-[10px] bg-bg-2 text-ink-dim border border-line">{b.entity.replace(/_/g, ' ').toLowerCase()}</span> : null}
                    {b.periodMonth ? <span className="ml-2 pill text-[10px] bg-entity-bytes/10 text-entity-bytes border border-entity-bytes/30">{b.periodMonth}</span> : null}
                  </div>
                  {b.commitmentLabel ? (
                    <div className="text-[11px] mt-1 text-warn">↳ Investment: {b.commitmentLabel}</div>
                  ) : null}
                  {b.notes ? <div className="text-[11px] text-ink-mute mt-1">{b.notes}</div> : null}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-wider text-ink-mute">{b.periodMonth ? b.periodMonth : 'This month'}</div>
                  <div className="mono tabnum text-base">{fmtCents(b.spentThisMonthCents)}</div>
                  {cap ? <div className="text-[10px] text-ink-mute">of {fmtCents(cap)} ({pct.toFixed(0)}%)</div> : null}
                </div>
              </div>
              {cap ? (
                <div className="mt-2 h-1.5 bg-bg-2 rounded overflow-hidden">
                  <div className={`h-full ${pct > 100 ? 'bg-flag-critText' : pct > 80 ? 'bg-warn' : b.kind === 'EXPENSE' ? 'bg-expense' : 'bg-income'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between text-[11px] text-ink-mute">
                <span>{b.txCountThisMonth} this month · {b.txCountAllTime} all time · {fmtCents(b.spentAllTimeCents)} total</span>
                <span className="flex items-center gap-3">
                  <button type="button" onClick={() => onArchive(b.id, !archived)} className="hover:text-ink inline-flex items-center gap-1">
                    <Archive size={11} /> {archived ? 'Unarchive' : 'Archive'}
                  </button>
                  <button type="button" onClick={() => onDelete(b.id)} className="text-flag-critText hover:underline inline-flex items-center gap-1">
                    <Trash2 size={11} /> Delete
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
