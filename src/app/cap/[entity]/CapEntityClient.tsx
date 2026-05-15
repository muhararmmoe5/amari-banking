'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { EntityType } from '@/types';
import type { Person, EquityHolding, CashContribution, SafeNote, EntityValuation, HolderType } from '@/types/cap';
import { parseAmountToCents, fmtCents, fmtPct, vestedFraction } from '@/lib/cap';
import { useToast } from '@/components/Toast';
import {
  actCreateHolding, actUpdateHolding, actDeleteHolding,
  actCreateContribution, actDeleteContribution,
  actCreateSafe, actUpdateSafeStatus, actDeleteSafe,
  actCreateValuation, actDeleteValuation,
} from '../actions';

interface Props {
  entity: EntityType;
  people: Person[];
  initialHoldings: EquityHolding[];
  initialContributions: CashContribution[];
  initialSafes: SafeNote[];
  initialValuations: EntityValuation[];
}

const HOLDER_TYPES: { value: HolderType; label: string; color: string }[] = [
  { value: 'PARTNER', label: 'Partner', color: '#C8F060' },
  { value: 'TEAM_MEMBER', label: 'Team member', color: '#60C8F0' },
  { value: 'OBSERVER', label: 'Observer', color: '#888888' },
];

const holderConfig = (t: HolderType) => HOLDER_TYPES.find((h) => h.value === t) || HOLDER_TYPES[0];

const SLICE_COLORS = ['#C8F060', '#60C8F0', '#F0A060', '#C060F0', '#FBBF24', '#F87171', '#A0D8FF', '#A8D840', '#D880FF', '#666666'];

export default function CapEntityClient(props: Props) {
  const { entity, people } = props;
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const [holdings, setHoldings] = useState(props.initialHoldings);
  const [contributions, setContributions] = useState(props.initialContributions);
  const [safes, setSafes] = useState(props.initialSafes);
  const [valuations, setValuations] = useState(props.initialValuations);
  const [tab, setTab] = useState<'equity' | 'cash' | 'safes' | 'valuation'>('equity');
  const currentValuation = valuations[0]?.valuationCents || null;

  const totalPct = holdings.reduce((s, h) => s + h.percent, 0);
  const unallocated = Math.max(0, 100 - totalPct);

  const pieData = useMemo(() => {
    const data = holdings.map((h) => ({
      name: peopleById.get(h.personId)?.name || '?',
      value: h.percent,
      id: h.id,
    }));
    if (unallocated > 0.01) {
      data.push({ name: 'Unallocated', value: unallocated, id: 'unallocated' });
    }
    return data;
  }, [holdings, peopleById, unallocated]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-ink-mute uppercase tracking-wider">Ownership</div>
          <div className="h-48 mt-2 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={1.5}
                  stroke="#0C0C0E"
                  strokeWidth={2}
                >
                  {pieData.map((d, i) => (
                    <Cell key={d.id} fill={d.id === 'unallocated' ? '#26262C' : SLICE_COLORS[i % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#141417', border: '1px solid #26262C', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => fmtPct(v, 2)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between text-xs text-ink-dim mt-2">
            <span>Allocated</span>
            <span className={`mono tabnum ${Math.abs(totalPct - 100) < 0.01 ? 'text-income' : 'text-warn'}`}>{fmtPct(totalPct, 2)}</span>
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-ink-mute uppercase tracking-wider">Total cash in</div>
          <div className="mono tabnum text-2xl mt-2 text-income">
            {fmtCents(contributions.reduce((s, c) => s + c.amountCents, 0))}
          </div>
          <div className="text-[11px] text-ink-mute mt-1">{contributions.length} contribution{contributions.length === 1 ? '' : 's'}</div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-ink-mute uppercase tracking-wider">SAFEs outstanding</div>
          <div className="mono tabnum text-2xl mt-2">
            {fmtCents(safes.filter((s) => s.status === 'OUTSTANDING').reduce((s, n) => s + n.amountCents, 0))}
          </div>
          <div className="text-[11px] text-ink-mute mt-1">
            {safes.filter((s) => s.status === 'OUTSTANDING').length} outstanding · {safes.filter((s) => s.status === 'CONVERTED').length} converted
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-ink-mute uppercase tracking-wider">Current valuation</div>
          <div className="mono tabnum text-2xl mt-2">
            {currentValuation != null ? fmtCents(currentValuation) : <span className="text-ink-mute">Not set</span>}
          </div>
          <div className="text-[11px] text-ink-mute mt-1">
            {valuations[0] ? `as of ${valuations[0].asOfDate} · ${valuations[0].type.replace('_', ' ').toLowerCase()}` : 'Add one in the Valuation tab'}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {(['equity', 'cash', 'safes', 'valuation'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition border-b-2 -mb-px ${
              tab === t ? 'border-entity-bytes text-ink' : 'border-transparent text-ink-dim hover:text-ink'
            }`}
          >
            {t === 'equity' ? `Equity (${holdings.length})`
              : t === 'cash' ? `Contributions (${contributions.length})`
              : t === 'safes' ? `SAFEs / Notes (${safes.length})`
              : `Valuation (${valuations.length})`}
          </button>
        ))}
      </div>

      {tab === 'equity' ? (
        <EquityTab
          entity={entity}
          people={people}
          holdings={holdings}
          setHoldings={setHoldings}
          peopleById={peopleById}
          unallocated={unallocated}
          currentValuation={currentValuation}
        />
      ) : tab === 'cash' ? (
        <CashTab
          entity={entity}
          people={people}
          contributions={contributions}
          setContributions={setContributions}
          peopleById={peopleById}
        />
      ) : tab === 'safes' ? (
        <SafesTab
          entity={entity}
          people={people}
          safes={safes}
          setSafes={setSafes}
          peopleById={peopleById}
        />
      ) : (
        <ValuationTab
          entity={entity}
          valuations={valuations}
          setValuations={setValuations}
        />
      )}
    </div>
  );
}

// ===== Equity tab =====
function EquityTab({
  entity, people, holdings, setHoldings, peopleById, unallocated, currentValuation,
}: {
  entity: EntityType;
  people: Person[];
  holdings: EquityHolding[];
  setHoldings: (h: EquityHolding[] | ((cur: EquityHolding[]) => EquityHolding[])) => void;
  peopleById: Map<string, Person>;
  unallocated: number;
  currentValuation: number | null;
}) {
  const [adding, setAdding] = useState(false);
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError, toast } = useToast();

  async function add(form: HTMLFormElement) {
    const fd = new FormData(form);
    const personId = String(fd.get('personId') || '');
    const percent = parseFloat(String(fd.get('percent') || '0'));
    if (!personId) { toast({ kind: 'err', title: 'Pick a person' }); return; }
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) { toast({ kind: 'err', title: 'Invalid percent' }); return; }
    const sharesStr = String(fd.get('shares') || '').trim();
    const shares = sharesStr ? parseInt(sharesStr, 10) : null;
    const grantDate = String(fd.get('grantDate') || '').trim() || null;
    const useVesting = fd.get('useVesting') === 'on';
    const cliffStr = String(fd.get('cliffMonths') || '').trim();
    const totalStr = String(fd.get('totalMonths') || '').trim();
    const tId = saveStart();
    startTx(async () => {
      try {
        const h = await actCreateHolding({
          entity,
          personId,
          percent,
          shares: shares && Number.isFinite(shares) ? shares : null,
          holderType: (String(fd.get('holderType') || 'PARTNER') as HolderType),
          grantDate,
          vestingCliffMonths: useVesting && cliffStr ? parseInt(cliffStr, 10) : null,
          vestingTotalMonths: useVesting && totalStr ? parseInt(totalStr, 10) : null,
          vestingStart: useVesting ? grantDate : null,
          notes: String(fd.get('notes') || '').trim() || null,
        });
        setHoldings((cur) => [...cur, h].sort((a, b) => b.percent - a.percent));
        saveEnd(tId);
        setAdding(false);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  async function remove(h: EquityHolding) {
    if (!confirm(`Remove ${peopleById.get(h.personId)?.name || 'this'} holding (${fmtPct(h.percent)})?`)) return;
    const tId = saveStart();
    startTx(async () => {
      try {
        await actDeleteHolding(h.id);
        setHoldings((cur) => cur.filter((x) => x.id !== h.id));
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-ink-dim">
          {unallocated > 0.01 ? <span className="text-warn">{fmtPct(unallocated, 2)} unallocated</span> : <span className="text-income">Fully allocated</span>}
        </div>
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} disabled={people.length === 0} className="btn btn-primary text-sm">
            <Plus size={14} /> Add holding
          </button>
        ) : null}
      </div>

      {adding ? (
        <form className="card p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); add(e.currentTarget); }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Person *">
              <select name="personId" required>
                <option value="">Select…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Role *">
              <select name="holderType" defaultValue="PARTNER">
                {HOLDER_TYPES.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </Field>
            <Field label="Percent * (0–100)">
              <input name="percent" type="number" step="0.0001" min="0.0001" max="100" required defaultValue={unallocated > 0 ? unallocated.toFixed(2) : ''} />
            </Field>
            <Field label="Shares (optional)">
              <input name="shares" type="number" min="0" step="1" />
            </Field>
            <Field label="Grant date">
              <input name="grantDate" type="date" />
            </Field>
            <Field label="Vesting?">
              <label className="inline-flex items-center gap-2 text-sm h-[34px]">
                <input type="checkbox" name="useVesting" className="accent-entity-bytes" />
                <span className="text-ink-dim">Enable cliff + monthly vest</span>
              </label>
            </Field>
            <Field label="Cliff (mo) / Total (mo)">
              <div className="flex gap-2">
                <input name="cliffMonths" type="number" min="0" step="1" placeholder="12" className="w-1/2" />
                <input name="totalMonths" type="number" min="1" step="1" placeholder="48" className="w-1/2" />
              </div>
            </Field>
            <Field label="Notes">
              <input name="notes" maxLength={500} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn">Cancel</button>
            <button type="submit" className="btn btn-primary">Add holding</button>
          </div>
        </form>
      ) : null}

      {holdings.length === 0 ? (
        <div className="card p-10 text-center text-ink-mute text-sm">
          No equity allocated for this entity yet.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 text-ink-dim text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Person</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-right px-3 py-2 font-medium">% granted</th>
                <th className="text-right px-3 py-2 font-medium">% vested</th>
                <th className="text-right px-3 py-2 font-medium">Vested value</th>
                <th className="text-left px-3 py-2 font-medium">Vesting</th>
                <th className="text-right px-3 py-2 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const vested = vestedFraction(h);
                const vestedPct = h.percent * vested;
                const hasVesting = !!(h.vestingTotalMonths && h.vestingStart);
                const vestedValue = currentValuation != null ? Math.round(((vestedPct) / 100) * currentValuation) : null;
                const hc = holderConfig(h.holderType);
                return (
                  <tr key={h.id} className="border-t border-line/60">
                    <td className="px-3 py-2">
                      <Link href={`/team/${h.personId}`} className="hover:text-entity-bytes">{peopleById.get(h.personId)?.name || '?'}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="pill text-[10px]"
                        style={{ background: `${hc.color}1f`, color: hc.color, border: `1px solid ${hc.color}40` }}
                      >
                        {hc.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right mono tabnum">{fmtPct(h.percent, 2)}</td>
                    <td className="px-3 py-2 text-right mono tabnum">
                      {hasVesting ? <span className={vested >= 1 ? 'text-income' : 'text-warn'}>{fmtPct(vestedPct, 2)}</span> : <span className="text-ink-dim">100.00%</span>}
                    </td>
                    <td className="px-3 py-2 text-right mono tabnum">
                      {vestedValue != null ? <span className="text-income">{fmtCents(vestedValue)}</span> : <span className="text-ink-mute">—</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-dim">
                      {hasVesting
                        ? `${h.vestingCliffMonths || 0}mo cliff / ${h.vestingTotalMonths}mo total · start ${h.vestingStart}`
                        : 'no vesting'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => remove(h)} className="btn btn-ghost !p-1.5 text-expense" title="Delete"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== Cash contributions tab =====
function CashTab({
  entity, people, contributions, setContributions, peopleById,
}: {
  entity: EntityType;
  people: Person[];
  contributions: CashContribution[];
  setContributions: (c: CashContribution[] | ((cur: CashContribution[]) => CashContribution[])) => void;
  peopleById: Map<string, Person>;
}) {
  const [adding, setAdding] = useState(false);
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError, toast } = useToast();

  // Per-person rollup
  const byPerson = new Map<string, { total: number; count: number }>();
  for (const c of contributions) {
    const cur = byPerson.get(c.personId) || { total: 0, count: 0 };
    cur.total += c.amountCents;
    cur.count += 1;
    byPerson.set(c.personId, cur);
  }

  async function add(form: HTMLFormElement) {
    const fd = new FormData(form);
    const personId = String(fd.get('personId') || '');
    const amountCents = parseAmountToCents(String(fd.get('amount') || ''));
    const date = String(fd.get('date') || '').trim();
    if (!personId) { toast({ kind: 'err', title: 'Pick a person' }); return; }
    if (!amountCents) { toast({ kind: 'err', title: 'Invalid amount' }); return; }
    if (!date) { toast({ kind: 'err', title: 'Date required' }); return; }
    const tId = saveStart();
    startTx(async () => {
      try {
        const c = await actCreateContribution({
          entity,
          personId,
          amountCents,
          contributionDate: date,
          type: (String(fd.get('type') || 'CASH') as CashContribution['type']),
          notes: String(fd.get('notes') || '').trim() || null,
        });
        setContributions((cur) => [c, ...cur].sort((a, b) => b.contributionDate.localeCompare(a.contributionDate)));
        saveEnd(tId);
        setAdding(false);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  async function remove(c: CashContribution) {
    if (!confirm(`Delete this ${fmtCents(c.amountCents)} contribution?`)) return;
    const tId = saveStart();
    startTx(async () => {
      try {
        await actDeleteContribution(c.id);
        setContributions((cur) => cur.filter((x) => x.id !== c.id));
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} disabled={people.length === 0} className="btn btn-primary text-sm">
            <Plus size={14} /> Log contribution
          </button>
        ) : null}
      </div>

      {adding ? (
        <form className="card p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); add(e.currentTarget); }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Person *">
              <select name="personId" required>
                <option value="">Select…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Amount (USD) *">
              <input name="amount" required pattern="^\d{1,12}(\.\d{1,2})?$" placeholder="10000.00" />
            </Field>
            <Field label="Date *">
              <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Type">
              <select name="type" defaultValue="CASH">
                <option value="CASH">Cash equity</option>
                <option value="LOAN">Loan</option>
                <option value="SWEAT">Sweat equity</option>
                <option value="NOTE_CONVERSION">Note conversion</option>
              </select>
            </Field>
            <Field label="Notes">
              <input name="notes" maxLength={500} className="md:col-span-2" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn">Cancel</button>
            <button type="submit" className="btn btn-primary">Log</button>
          </div>
        </form>
      ) : null}

      {byPerson.size > 0 ? (
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-ink-mute mb-2">Total per person</div>
          <div className="space-y-1">
            {Array.from(byPerson.entries())
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([pid, info]) => (
                <div key={pid} className="flex items-center justify-between text-sm">
                  <span>{peopleById.get(pid)?.name || '?'}</span>
                  <span className="mono tabnum text-income">{fmtCents(info.total)}<span className="text-ink-mute text-xs ml-2">{info.count} entries</span></span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {contributions.length === 0 ? (
        <div className="card p-10 text-center text-ink-mute text-sm">
          No contributions logged yet.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 text-ink-dim text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Person</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Notes</th>
                <th className="text-right px-3 py-2 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => (
                <tr key={c.id} className="border-t border-line/60">
                  <td className="px-3 py-2 text-xs text-ink-dim mono">{c.contributionDate}</td>
                  <td className="px-3 py-2">{peopleById.get(c.personId)?.name || '?'}</td>
                  <td className="px-3 py-2 text-right mono tabnum text-income">{fmtCents(c.amountCents)}</td>
                  <td className="px-3 py-2 text-xs text-ink-dim">{c.type.replace('_', ' ').toLowerCase()}</td>
                  <td className="px-3 py-2 text-xs text-ink-dim truncate max-w-[280px]">{c.notes || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(c)} className="btn btn-ghost !p-1.5 text-expense" title="Delete"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== SAFEs tab =====
function SafesTab({
  entity, people, safes, setSafes, peopleById,
}: {
  entity: EntityType;
  people: Person[];
  safes: SafeNote[];
  setSafes: (s: SafeNote[] | ((cur: SafeNote[]) => SafeNote[])) => void;
  peopleById: Map<string, Person>;
}) {
  const [adding, setAdding] = useState(false);
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError, toast } = useToast();

  async function add(form: HTMLFormElement) {
    const fd = new FormData(form);
    const personId = String(fd.get('personId') || '');
    const amountCents = parseAmountToCents(String(fd.get('amount') || ''));
    const issueDate = String(fd.get('issueDate') || '').trim();
    if (!personId || !amountCents || !issueDate) { toast({ kind: 'err', title: 'Person, amount, and date are required' }); return; }
    const cap = parseAmountToCents(String(fd.get('cap') || ''));
    const discount = parseFloat(String(fd.get('discount') || ''));
    const interest = parseFloat(String(fd.get('interest') || ''));
    const tId = saveStart();
    startTx(async () => {
      try {
        const s = await actCreateSafe({
          entity,
          personId,
          amountCents,
          issueDate,
          valuationCapCents: cap,
          discountPct: Number.isFinite(discount) && discount > 0 ? discount : null,
          mfn: fd.get('mfn') === 'on',
          noteType: (String(fd.get('noteType') || 'SAFE') as 'SAFE' | 'CONVERTIBLE_NOTE'),
          interestRatePct: Number.isFinite(interest) && interest > 0 ? interest : null,
          maturityDate: String(fd.get('maturity') || '').trim() || null,
          notes: String(fd.get('notes') || '').trim() || null,
        });
        setSafes((cur) => [s, ...cur].sort((a, b) => b.issueDate.localeCompare(a.issueDate)));
        saveEnd(tId);
        setAdding(false);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  async function setStatus(s: SafeNote, status: 'OUTSTANDING' | 'CONVERTED' | 'CANCELED') {
    if (status === 'CANCELED' && !confirm('Cancel this SAFE? It will not count toward future conversions.')) return;
    const tId = saveStart();
    startTx(async () => {
      try {
        await actUpdateSafeStatus(s.id, status);
        setSafes((cur) => cur.map((x) => (x.id === s.id ? { ...x, status } : x)));
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  async function remove(s: SafeNote) {
    if (!confirm(`Delete this ${fmtCents(s.amountCents)} ${s.noteType}?`)) return;
    const tId = saveStart();
    startTx(async () => {
      try {
        await actDeleteSafe(s.id);
        setSafes((cur) => cur.filter((x) => x.id !== s.id));
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} disabled={people.length === 0} className="btn btn-primary text-sm">
            <Plus size={14} /> New SAFE / Note
          </button>
        ) : null}
      </div>

      {adding ? (
        <form className="card p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); add(e.currentTarget); }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Investor *">
              <select name="personId" required>
                <option value="">Select…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Amount (USD) *">
              <input name="amount" required pattern="^\d{1,12}(\.\d{1,2})?$" placeholder="50000" />
            </Field>
            <Field label="Issue date *">
              <input name="issueDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Type">
              <select name="noteType" defaultValue="SAFE">
                <option value="SAFE">SAFE</option>
                <option value="CONVERTIBLE_NOTE">Convertible note</option>
              </select>
            </Field>
            <Field label="Valuation cap (USD)">
              <input name="cap" pattern="^\d{1,12}(\.\d{1,2})?$" placeholder="5000000" />
            </Field>
            <Field label="Discount %">
              <input name="discount" type="number" step="0.01" min="0" max="100" placeholder="20" />
            </Field>
            <Field label="MFN?">
              <label className="inline-flex items-center gap-2 text-sm h-[34px]">
                <input type="checkbox" name="mfn" className="accent-entity-bytes" />
                <span className="text-ink-dim">Most-favored-nation clause</span>
              </label>
            </Field>
            <Field label="Interest % (notes)">
              <input name="interest" type="number" step="0.01" min="0" max="100" placeholder="5" />
            </Field>
            <Field label="Maturity (notes)">
              <input name="maturity" type="date" />
            </Field>
            <Field label="Notes">
              <input name="notes" maxLength={500} className="md:col-span-3" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn">Cancel</button>
            <button type="submit" className="btn btn-primary">Add</button>
          </div>
        </form>
      ) : null}

      {safes.length === 0 ? (
        <div className="card p-10 text-center text-ink-mute text-sm">
          No SAFEs or convertible notes yet.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 text-ink-dim text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Issued</th>
                <th className="text-left px-3 py-2 font-medium">Investor</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">Cap</th>
                <th className="text-right px-3 py-2 font-medium">Discount</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-right px-3 py-2 font-medium w-32"></th>
              </tr>
            </thead>
            <tbody>
              {safes.map((s) => (
                <tr key={s.id} className="border-t border-line/60">
                  <td className="px-3 py-2 text-xs text-ink-dim mono">{s.issueDate}</td>
                  <td className="px-3 py-2">{peopleById.get(s.personId)?.name || '?'}</td>
                  <td className="px-3 py-2 text-right mono tabnum">{fmtCents(s.amountCents)}</td>
                  <td className="px-3 py-2 text-xs text-ink-dim">
                    {s.noteType === 'SAFE' ? 'SAFE' : 'Conv. note'}
                    {s.mfn ? ' · MFN' : ''}
                  </td>
                  <td className="px-3 py-2 text-right mono tabnum text-ink-dim">{s.valuationCapCents ? fmtCents(s.valuationCapCents) : '—'}</td>
                  <td className="px-3 py-2 text-right mono tabnum text-ink-dim">{s.discountPct ? fmtPct(s.discountPct) : '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    <select
                      defaultValue={s.status}
                      onChange={(e) => setStatus(s, e.target.value as any)}
                      className="text-xs"
                    >
                      <option value="OUTSTANDING">Outstanding</option>
                      <option value="CONVERTED">Converted</option>
                      <option value="CANCELED">Canceled</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(s)} className="btn btn-ghost !p-1.5 text-expense" title="Delete"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">{label}</div>
      <div>{children}</div>
    </label>
  );
}

// ===== Valuation tab =====
function ValuationTab({
  entity, valuations, setValuations,
}: {
  entity: EntityType;
  valuations: EntityValuation[];
  setValuations: (v: EntityValuation[] | ((cur: EntityValuation[]) => EntityValuation[])) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [, startTx] = useTransition();
  const { saveStart, saveEnd, saveError, toast } = useToast();

  async function add(form: HTMLFormElement) {
    const fd = new FormData(form);
    const amountCents = parseAmountToCents(String(fd.get('amount') || ''));
    const date = String(fd.get('date') || '').trim();
    if (!amountCents) { toast({ kind: 'err', title: 'Enter a valuation amount' }); return; }
    if (!date) { toast({ kind: 'err', title: 'Date required' }); return; }
    const tId = saveStart();
    startTx(async () => {
      try {
        const v = await actCreateValuation({
          entity,
          valuationCents: amountCents,
          asOfDate: date,
          type: (String(fd.get('type') || 'MANUAL') as EntityValuation['type']),
          notes: String(fd.get('notes') || '').trim() || null,
        });
        setValuations((cur) => [v, ...cur].sort((a, b) => b.asOfDate.localeCompare(a.asOfDate)));
        saveEnd(tId);
        setAdding(false);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  async function remove(v: EntityValuation) {
    if (!confirm(`Delete the ${fmtCents(v.valuationCents)} valuation from ${v.asOfDate}?`)) return;
    const tId = saveStart();
    startTx(async () => {
      try {
        await actDeleteValuation(v.id);
        setValuations((cur) => cur.filter((x) => x.id !== v.id));
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-dim">
          The most recent entry is the entity&apos;s current valuation. Used to compute portfolio value for every holder.
        </p>
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-primary text-sm">
            <Plus size={14} /> Set valuation
          </button>
        ) : null}
      </div>

      {adding ? (
        <form className="card p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); add(e.currentTarget); }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Valuation (USD) *">
              <input name="amount" required pattern="^\d{1,12}(\.\d{1,2})?$" placeholder="5000000" />
            </Field>
            <Field label="As of date *">
              <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Type">
              <select name="type" defaultValue="MANUAL">
                <option value="MANUAL">Manual estimate</option>
                <option value="LAST_ROUND">Last priced round</option>
                <option value="409A">409A appraisal</option>
                <option value="INTERNAL">Internal model</option>
                <option value="EXIT">Exit / acquisition</option>
              </select>
            </Field>
            <Field label="Notes" className="md:col-span-3">
              <input name="notes" maxLength={500} placeholder="e.g. Series Seed priced at $5M post-money on 2026-04-15" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn">Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      ) : null}

      {valuations.length === 0 ? (
        <div className="card p-10 text-center text-ink-mute text-sm">
          No valuation set. Add one so every holder&apos;s portfolio value can be calculated.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 text-ink-dim text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">As of</th>
                <th className="text-right px-3 py-2 font-medium">Valuation</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-left px-3 py-2 font-medium">Notes</th>
                <th className="text-right px-3 py-2 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {valuations.map((v, i) => (
                <tr key={v.id} className={`border-t border-line/60 ${i === 0 ? 'bg-entity-bytes/[0.04]' : ''}`}>
                  <td className="px-3 py-2 text-xs mono">
                    {v.asOfDate}
                    {i === 0 ? <span className="ml-2 pill text-[10px] bg-entity-bytes/15 text-entity-bytes border border-entity-bytes/40">current</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right mono tabnum">{fmtCents(v.valuationCents)}</td>
                  <td className="px-3 py-2 text-xs text-ink-dim">{v.type.replace('_', ' ').toLowerCase()}</td>
                  <td className="px-3 py-2 text-xs text-ink-dim truncate max-w-[320px]">{v.notes || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => remove(v)} className="btn btn-ghost !p-1.5 text-expense" title="Delete"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
