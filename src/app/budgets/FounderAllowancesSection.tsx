'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2 } from 'lucide-react';
import { actCreateFounderAllowance, actUpdateBudget, actDeleteBudget } from './actions';
import type { FounderAllowanceUsage } from '@/lib/db/budgets';

interface Person { id: string; name: string }
interface EntityOpt { value: string; label: string }
interface AccountOpt { id: string; label: string; entity: string }

export default function FounderAllowancesSection({
  allowances: initial, people, entityOptions, accountOptions,
}: {
  allowances: FounderAllowanceUsage[];
  people: Person[];
  entityOptions: EntityOpt[];
  accountOptions: AccountOpt[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Founder allowances</h2>
          <p className="text-xs text-ink-dim mt-1 max-w-xl">
            Monthly personal-spend caps a company gives a founder in lieu of salary. Any transaction tagged to
            the founder (Individual field) on a company account counts against that month&apos;s cap.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="btn btn-primary btn-sm flex items-center gap-2"
        >
          <Plus size={13} /> {creating ? 'Cancel' : 'New allowance'}
        </button>
      </div>

      {msg ? (
        <div className="mb-3 text-xs" style={{ color: msg.startsWith('Fail') ? 'var(--danger, #ff7676)' : 'var(--income)' }}>
          {msg}
        </div>
      ) : null}

      {creating ? (
        <NewAllowanceForm
          people={people}
          entityOptions={entityOptions}
          accountOptions={accountOptions}
          disabled={isPending}
          onSubmit={(data) => {
            startTransition(async () => {
              try {
                const person = people.find((p) => p.id === data.personId);
                if (!person) { setMsg('Fail: pick a person'); return; }
                await actCreateFounderAllowance({
                  entity: data.entity,
                  personId: data.personId,
                  personName: person.name,
                  monthlyAmountCents: Math.round(data.monthlyDollars * 100),
                  periodMonth: data.periodMonth || null,
                  linkedAccountIds: data.linkedAccountIds,
                  notes: data.notes || null,
                });
                setCreating(false);
                setMsg('Allowance created');
                router.refresh();
              } catch (e) {
                setMsg(`Fail: ${e instanceof Error ? e.message : 'unknown'}`);
              }
            });
          }}
        />
      ) : null}

      {initial.length === 0 && !creating ? (
        <div className="p-6 text-center text-sm text-ink-dim border border-dashed border-line rounded-lg">
          No founder allowances yet. Create one to track your personal spend on company cards against a monthly cap.
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {initial.map((a) => (
          <AllowanceCard
            key={a.id}
            allowance={a}
            accountOptions={accountOptions}
            disabled={isPending}
            onUpdate={(patch) => {
              startTransition(async () => {
                try {
                  await actUpdateBudget(a.id, patch);
                  setMsg('Allowance updated');
                  router.refresh();
                } catch (e) {
                  setMsg(`Fail: ${e instanceof Error ? e.message : 'unknown'}`);
                }
              });
            }}
            onDelete={() => {
              if (!window.confirm(`Delete ${a.personName}'s allowance from ${a.entity}?`)) return;
              startTransition(async () => {
                try {
                  await actDeleteBudget(a.id);
                  setMsg('Allowance deleted');
                  router.refresh();
                } catch (e) {
                  setMsg(`Fail: ${e instanceof Error ? e.message : 'unknown'}`);
                }
              });
            }}
          />
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────

function NewAllowanceForm({
  people, entityOptions, accountOptions, disabled, onSubmit,
}: {
  people: Person[];
  entityOptions: EntityOpt[];
  accountOptions: AccountOpt[];
  disabled: boolean;
  onSubmit: (data: {
    entity: string; personId: string; monthlyDollars: number;
    periodMonth: string; linkedAccountIds: string[]; notes: string;
  }) => void;
}) {
  const [entity, setEntity] = useState(entityOptions[0]?.value || '');
  const [personId, setPersonId] = useState(people[0]?.id || '');
  const [monthlyDollars, setMonthlyDollars] = useState('6000');
  const [periodMonth, setPeriodMonth] = useState('');
  const [linkedAccounts, setLinkedAccounts] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');

  const canSubmit = !!entity && !!personId && parseFloat(monthlyDollars) > 0 && !disabled;

  function toggleAccount(id: string) {
    setLinkedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          entity, personId,
          monthlyDollars: parseFloat(monthlyDollars),
          periodMonth,
          linkedAccountIds: Array.from(linkedAccounts),
          notes,
        });
      }}
      className="mb-4 p-4 rounded-lg space-y-3"
      style={{
        background: 'color-mix(in oklab, var(--gold) 4%, var(--bg-1, #111114))',
        border: '1px solid color-mix(in oklab, var(--gold) 20%, rgba(255,255,255,0.06))',
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Company</div>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="w-full">
            {entityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Founder</div>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="w-full">
            {people.length === 0 ? <option value="">— add a person first —</option> : null}
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Monthly cap ($)</div>
          <input
            type="number" min="0" step="100"
            value={monthlyDollars}
            onChange={(e) => setMonthlyDollars(e.target.value)}
            className="w-full"
            placeholder="6000"
          />
        </label>
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">
            Month (optional) <span className="text-ink-dim normal-case tracking-normal">— leave blank to apply every month</span>
          </div>
          <input
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="w-full"
          />
        </label>
      </div>

      {/* Bank account picker — the missing piece: tell the allowance
          exactly which accounts to attribute against. Falls back to
          entity-mapped accounts + confirmed_entity if nothing is
          checked, so the old default still works. */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">
          Bank accounts to attribute{' '}
          <span className="text-ink-dim normal-case tracking-normal">
            — optional. Leave all unchecked to include any account
            booked to this company via the Books-to tag.
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-52 overflow-y-auto pr-1">
          {accountOptions.map((a) => (
            <label
              key={a.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer"
              style={{
                background: linkedAccounts.has(a.id) ? 'color-mix(in oklab, var(--gold) 10%, transparent)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={linkedAccounts.has(a.id)}
                onChange={() => toggleAccount(a.id)}
              />
              <span className="text-xs text-ink flex-1 truncate">{a.label}</span>
              <span className="text-[10px] text-ink-mute">{a.entity.replace(/_/g, ' ').toLowerCase()}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">Notes (optional)</div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full"
          placeholder="e.g. In lieu of salary until Series A closes"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary flex items-center gap-2"
          style={{ opacity: canSubmit ? 1 : 0.5 }}
        >
          <Check size={13} /> Create allowance
        </button>
      </div>
    </form>
  );
}

function AllowanceCard({
  allowance: a, accountOptions, disabled, onUpdate, onDelete,
}: {
  allowance: FounderAllowanceUsage;
  accountOptions: AccountOpt[];
  disabled: boolean;
  onUpdate: (patch: {
    monthlyAmountCents?: number;
    periodMonth?: string | null;
    linkedAccountIds?: string[];
  }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(((a.monthlyAmountCents ?? 0) / 100).toString());
  const [period, setPeriod] = useState(a.periodMonth || '');
  const [linked, setLinked] = useState<Set<string>>(() => new Set(a.linkedAccountIds));
  function toggleLinked(id: string) {
    setLinked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const cap = a.monthlyAmountCents ?? 0;
  const spent = a.spentThisMonthCents;
  const pct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
  const remaining = a.remainingCents;
  const over = spent > cap;
  const barColor = over ? 'var(--danger, #ff7676)' : pct > 80 ? 'var(--warn, #d4b16f)' : 'var(--income)';

  return (
    <div
      className="rounded-lg p-4"
      style={{
        background: 'var(--bg-1, #111114)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-ink-mute">
            {a.entity?.replace(/_/g, ' ')} · {a.periodMonth || 'monthly'}
          </div>
          <div className="text-sm font-medium truncate">{a.personName}</div>
          {a.notes ? <div className="text-[11px] text-ink-dim mt-1 line-clamp-2">{a.notes}</div> : null}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          title="Delete allowance"
          className="text-ink-mute hover:text-expense transition p-1"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-xl num" style={{ color: barColor, fontWeight: 500 }}>
          ${(spent / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span className="text-xs text-ink-dim num">
          / ${(cap / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} used
        </span>
        <span className="ml-auto text-[11px] num" style={{ color: over ? 'var(--danger, #ff7676)' : 'var(--ink-3)' }}>
          {over
            ? `−$${((spent - cap) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} over`
            : `$${(remaining / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} left`}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: barColor,
          transition: 'width 200ms ease',
        }} />
      </div>
      <div className="text-[10.5px] text-ink-dim mt-1.5">
        {a.txCountThisMonth} transaction{a.txCountThisMonth === 1 ? '' : 's'} · {a.effectiveMonth}
        {a.linkedAccountIds.length > 0 ? (
          <> · linked to {a.linkedAccountIds.length} account{a.linkedAccountIds.length === 1 ? '' : 's'}</>
        ) : (
          <> · any account booked to {a.entity?.replace(/_/g, ' ').toLowerCase()}</>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {!editing ? (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn btn-sm text-xs"
            >
              Edit
            </button>
            <Link
              href={`/transactions?individual=${encodeURIComponent(a.personName)}&entity=${a.entity}${a.periodMonth ? `&from=${a.periodMonth}-01&to=${a.periodMonth}-31` : ''}`}
              className="btn btn-sm text-xs"
            >
              See transactions
            </Link>
          </>
        ) : (
          <div className="w-full space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number" min="0" step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-xs w-24"
                placeholder="cap $"
              />
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="text-xs"
                placeholder="every month"
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-mute mb-1">
                Bank accounts to attribute
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-1">
                {accountOptions.map((acc) => (
                  <label
                    key={acc.id}
                    className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer"
                    style={{
                      background: linked.has(acc.id) ? 'color-mix(in oklab, var(--gold) 10%, transparent)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={linked.has(acc.id)}
                      onChange={() => toggleLinked(acc.id)}
                    />
                    <span className="text-[11px] flex-1 truncate">{acc.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const cents = Math.round(parseFloat(amount || '0') * 100);
                  if (!(cents >= 0)) return;
                  onUpdate({
                    monthlyAmountCents: cents,
                    periodMonth: period || null,
                    linkedAccountIds: Array.from(linked),
                  });
                  setEditing(false);
                }}
                disabled={disabled}
                className="btn btn-primary btn-sm text-xs"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setAmount(((a.monthlyAmountCents ?? 0) / 100).toString());
                  setPeriod(a.periodMonth || '');
                  setLinked(new Set(a.linkedAccountIds));
                }}
                className="btn btn-sm text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
