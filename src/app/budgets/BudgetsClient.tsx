'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Archive, Pencil, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { fmtCents } from '@/lib/cap';
import type { EntityType } from '@/types';
import type { BudgetWithSpend } from '@/lib/db/budgets';
import type { BudgetKind, BudgetSubKind } from '@/lib/budget-kinds';
import { BUDGET_SUB_KINDS } from '@/lib/budget-kinds';
import { actCreateBudget, actUpdateBudget, actDeleteBudget } from './actions';

const INCOME_SUB_KINDS: BudgetSubKind[] = ['INVESTMENT_INCOME', 'REVENUE', 'REFUND', 'OTHER_INCOME'];
const EXPENSE_SUB_KINDS: BudgetSubKind[] = ['OPERATING', 'PAYROLL', 'MARKETING', 'COGS', 'TAXES', 'OTHER_EXPENSE'];

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
  personId: string;
  personName: string | null;
}

interface PersonOption { id: string; name: string }

export default function BudgetsClient({
  initial, commitments, people,
}: { initial: BudgetWithSpend[]; commitments: CommitmentOption[]; people: PersonOption[] }) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [, startTx] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  function onCreate(form: FormData) {
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    const tid = saveStart();
    startTx(async () => {
      try {
        const commitmentId = (form.get('commitmentId') as string) || null;
        // Auto-fill person from the commitment if a commitment is picked but person is not.
        let personId = (form.get('personId') as string) || null;
        if (!personId && commitmentId) {
          const c = commitments.find((x) => x.id === commitmentId);
          if (c?.personId) personId = c.personId;
        }
        await actCreateBudget({
          name,
          entity: (form.get('entity') as EntityType) || null,
          kind: (form.get('kind') as BudgetKind) || 'EXPENSE',
          subKind: ((form.get('subKind') as string) || '') as BudgetSubKind || null,
          monthlyAmountCents: dollarsToCents(String(form.get('monthly') || '')),
          totalAmountCents: dollarsToCents(String(form.get('total') || '')),
          runwayMonths: form.get('runwayMonths') ? Number(form.get('runwayMonths')) : null,
          periodMonth: (form.get('periodMonth') as string) || null,
          fundingCommitmentId: commitmentId,
          personId,
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
        <CreateForm
          people={people}
          commitments={commitments}
          onSubmit={onCreate}
          onCancel={() => setAddOpen(false)}
        />
      ) : null}

      <BudgetList title="Active" budgets={active} commitments={commitments} people={people} onArchive={onArchive} onDelete={onDelete} />
      {archived.length > 0 ? (
        <BudgetList title="Archived" budgets={archived} commitments={commitments} people={people} onArchive={onArchive} onDelete={onDelete} archived />
      ) : null}
    </div>
  );
}

function CreateForm({
  people, commitments, onSubmit, onCancel,
}: {
  people: PersonOption[];
  commitments: CommitmentOption[];
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<BudgetKind>('EXPENSE');
  const subKindOpts = kind === 'INCOME' ? INCOME_SUB_KINDS : EXPENSE_SUB_KINDS;
  return (
    <form action={onSubmit} className="card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Name *</div>
          <input name="name" required placeholder="e.g. Bytes AI Marketing" className="w-full" />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Kind</div>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as BudgetKind)} className="w-full">
            <option value="EXPENSE">Expense budget (money going out)</option>
            <option value="INCOME">Income target (money coming in)</option>
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Sub kind</div>
          <select name="subKind" defaultValue="" className="w-full">
            <option value="">— general —</option>
            {subKindOpts.map((sk) => <option key={sk} value={sk}>{BUDGET_SUB_KINDS[sk]}</option>)}
          </select>
          <div className="text-[10px] text-ink-mute mt-1">Picking &ldquo;Investment income&rdquo; below pairs with a commitment + investor.</div>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Entity (optional)</div>
          <select name="entity" defaultValue="" className="w-full">
            {ENTITY_OPTIONS.map((o) => <option key={o.v || 'any'} value={o.v}>{o.l}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Master total ($, optional)</div>
          <input name="total" placeholder="900000" className="w-full" />
          <div className="text-[10px] text-ink-mute mt-1">The full cap, e.g. $900k. Leave blank for ongoing budgets.</div>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Runway (months, optional)</div>
          <input name="runwayMonths" type="number" placeholder="12" className="w-full" />
          <div className="text-[10px] text-ink-mute mt-1">How many months to spread total over.</div>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Monthly target ($, optional)</div>
          <input name="monthly" placeholder="75000" className="w-full" />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Specific month (optional)</div>
          <input name="periodMonth" type="month" className="w-full" />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Person (e.g. the investor)</div>
          <select name="personId" defaultValue="" className="w-full">
            <option value="">— none / auto-fill from commitment —</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Link to investor commitment</div>
          <select name="commitmentId" defaultValue="" className="w-full">
            <option value="">— not linked —</option>
            {commitments.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="block col-span-2">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Notes</div>
          <input name="notes" placeholder="What does this cover?" className="w-full" />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn">Cancel</button>
        <button type="submit" className="btn btn-primary">Create</button>
      </div>
    </form>
  );
}

function BudgetList({
  title, budgets, commitments, people, onArchive, onDelete, archived,
}: {
  title: string;
  budgets: BudgetWithSpend[];
  commitments: CommitmentOption[];
  people: PersonOption[];
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
        {budgets.map((b) => (
          <BudgetRow key={b.id} budget={b} commitments={commitments} people={people} archived={archived} onArchive={onArchive} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

function BudgetRow({
  budget: b, commitments, people, archived, onArchive, onDelete,
}: {
  budget: BudgetWithSpend;
  commitments: CommitmentOption[];
  people: PersonOption[];
  archived?: boolean;
  onArchive: (id: string, archive: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [, startTx] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(b.name);
  const [kind, setKind] = useState<BudgetKind>(b.kind);
  const [subKind, setSubKind] = useState<string>(b.subKind || '');
  const [entity, setEntity] = useState<string>(b.entity || '');
  const [monthly, setMonthly] = useState(b.monthlyAmountCents != null ? (b.monthlyAmountCents / 100).toString() : '');
  const [total, setTotal] = useState(b.totalAmountCents != null ? (b.totalAmountCents / 100).toString() : '');
  const [runwayMonths, setRunwayMonths] = useState(b.runwayMonths != null ? String(b.runwayMonths) : '');
  const [periodMonth, setPeriodMonth] = useState(b.periodMonth || '');
  const [commitmentId, setCommitmentId] = useState(b.fundingCommitmentId || '');
  const [personId, setPersonId] = useState(b.personId || '');
  const [notes, setNotes] = useState(b.notes || '');

  const subKindOpts = kind === 'INCOME' ? INCOME_SUB_KINDS : EXPENSE_SUB_KINDS;

  function onSave() {
    const tid = saveStart();
    startTx(async () => {
      try {
        // Auto-fill person from commitment if commitment set + person blank
        let effPersonId = personId;
        if (!effPersonId && commitmentId) {
          const c = commitments.find((x) => x.id === commitmentId);
          if (c?.personId) effPersonId = c.personId;
        }
        await actUpdateBudget(b.id, {
          name: name.trim() || b.name,
          kind,
          subKind: (subKind as BudgetSubKind) || null,
          entity: (entity as EntityType) || null,
          monthlyAmountCents: dollarsToCents(monthly),
          totalAmountCents: dollarsToCents(total),
          runwayMonths: runwayMonths ? Number(runwayMonths) : null,
          periodMonth: periodMonth || null,
          fundingCommitmentId: commitmentId || null,
          personId: effPersonId || null,
          notes: notes || null,
        });
        saveEnd(tid);
        setEditing(false);
      } catch (e: any) { saveError(tid, e?.message || 'failed'); }
    });
  }

  if (editing) {
    return (
      <div className="p-4 space-y-3 bg-bg-2/30">
        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Name</div>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Kind</div>
            <select value={kind} onChange={(e) => { setKind(e.target.value as BudgetKind); setSubKind(''); }} className="w-full">
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Sub kind</div>
            <select value={subKind} onChange={(e) => setSubKind(e.target.value)} className="w-full">
              <option value="">— general —</option>
              {subKindOpts.map((sk) => <option key={sk} value={sk}>{BUDGET_SUB_KINDS[sk]}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Entity</div>
            <select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-full">
              {ENTITY_OPTIONS.map((o) => <option key={o.v || 'any'} value={o.v}>{o.l}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Person (e.g. the investor)</div>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="w-full">
              <option value="">— none / auto from commitment —</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Master total ($)</div>
            <input value={total} onChange={(e) => setTotal(e.target.value)} className="w-full" placeholder="900000" />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Runway (months)</div>
            <input type="number" value={runwayMonths} onChange={(e) => setRunwayMonths(e.target.value)} className="w-full" placeholder="12" />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Monthly target ($)</div>
            <input value={monthly} onChange={(e) => setMonthly(e.target.value)} className="w-full" placeholder="75000" />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Specific month</div>
            <input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="w-full" />
          </label>
          <label className="block col-span-2">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Link to investor commitment</div>
            <select value={commitmentId} onChange={(e) => setCommitmentId(e.target.value)} className="w-full">
              <option value="">— not linked —</option>
              {commitments.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="block col-span-2">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Notes</div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="btn inline-flex items-center gap-1"><X size={12} /> Cancel</button>
          <button type="button" onClick={onSave} className="btn btn-primary inline-flex items-center gap-1"><Check size={12} /> Save</button>
        </div>
      </div>
    );
  }

  const cap = b.monthlyAmountCents;
  const pct = cap && cap > 0 ? (b.spentThisMonthCents / cap) * 100 : 0;
  return (
    <div className="p-5 hover:bg-bg-2/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold tracking-tight">
            <Link href={`/budgets/${b.id}`} className="hover:text-entity-bytes transition-colors">{b.name}</Link>
            <span className={`ml-2 pill text-[10px] ${b.kind === 'EXPENSE' ? 'bg-expense/10 text-expense border border-expense/30' : 'bg-income/10 text-income border border-income/30'}`}>{b.kind === 'EXPENSE' ? 'expense' : 'income'}</span>
            {b.subKind ? <span className="ml-2 pill text-[10px] bg-entity-bytes/15 text-entity-bytes border border-entity-bytes/30">{BUDGET_SUB_KINDS[b.subKind]}</span> : null}
            {b.entity ? <span className="ml-2 pill text-[10px] bg-bg-2 text-ink-dim border border-line">{b.entity.replace(/_/g, ' ').toLowerCase()}</span> : null}
            {b.periodMonth ? <span className="ml-2 pill text-[10px] bg-entity-bytes/10 text-entity-bytes border border-entity-bytes/30">{b.periodMonth}</span> : null}
          </div>
          {b.totalAmountCents ? (
            <div className="text-[11px] mt-1 text-ink-dim">
              💰 Master: {fmtCents(b.totalAmountCents)}{b.runwayMonths ? ` over ${b.runwayMonths} mo (~${fmtCents(Math.round(b.totalAmountCents / b.runwayMonths))}/mo target)` : ''}
            </div>
          ) : null}
          {b.personName ? (
            <div className="text-[11px] mt-1 text-ink-dim">👤 {b.personName}</div>
          ) : null}
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
          <button type="button" onClick={() => setEditing(true)} className="hover:text-ink inline-flex items-center gap-1">
            <Pencil size={11} /> Edit
          </button>
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
}
