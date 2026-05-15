'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Pencil } from 'lucide-react';
import type { Person, PersonRole } from '@/types/cap';
import { actCreatePerson, actUpdatePerson, actDeletePerson } from '../cap/actions';
import { useToast } from '@/components/Toast';
import { fmtCents } from '@/lib/cap';

const ROLES: { value: PersonRole; label: string; color: string }[] = [
  { value: 'FOUNDER', label: 'Founder', color: '#C8F060' },
  { value: 'INVESTOR', label: 'Investor', color: '#60C8F0' },
  { value: 'EMPLOYEE', label: 'Employee', color: '#A0D8FF' },
  { value: 'CONTRACTOR', label: 'Contractor', color: '#F0A060' },
  { value: 'ADVISOR', label: 'Advisor', color: '#C060F0' },
  { value: 'OTHER', label: 'Other', color: '#888888' },
];

const roleConfig = (r: PersonRole) => ROLES.find((x) => x.value === r) || ROLES[5];

export default function TeamClient({ initialPeople, portfolioMap }: { initialPeople: Person[]; portfolioMap: Record<string, number> }) {
  const [people, setPeople] = useState(initialPeople);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [, startTx] = useTransition();
  const { toast, saveStart, saveEnd, saveError } = useToast();

  async function add(form: HTMLFormElement) {
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (!name) { toast({ kind: 'err', title: 'Name required' }); return; }
    const tId = saveStart();
    startTx(async () => {
      try {
        const p = await actCreatePerson({
          name,
          email: String(fd.get('email') || '').trim() || null,
          role: (String(fd.get('role') || 'OTHER') as PersonRole),
          notes: String(fd.get('notes') || '').trim() || null,
        });
        setPeople((cur) => [...cur, p].sort((a, b) => a.name.localeCompare(b.name)));
        saveEnd(tId);
        setAdding(false);
      } catch (e: any) {
        saveError(tId, e?.message);
      }
    });
  }

  async function save(form: HTMLFormElement, person: Person) {
    const fd = new FormData(form);
    const tId = saveStart();
    const patch = {
      name: String(fd.get('name') || person.name).trim(),
      email: String(fd.get('email') || '').trim() || null,
      role: String(fd.get('role') || person.role) as PersonRole,
      notes: String(fd.get('notes') || '').trim() || null,
    };
    startTx(async () => {
      try {
        await actUpdatePerson(person.id, patch);
        setPeople((cur) => cur.map((p) => (p.id === person.id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
        saveEnd(tId);
        setEditing(null);
      } catch (e: any) {
        saveError(tId, e?.message);
      }
    });
  }

  async function remove(person: Person) {
    if (!confirm(`Delete ${person.name}? This also removes their holdings, contributions, and SAFEs.`)) return;
    const tId = saveStart();
    startTx(async () => {
      try {
        await actDeletePerson(person.id);
        setPeople((cur) => cur.filter((p) => p.id !== person.id));
        saveEnd(tId);
      } catch (e: any) {
        saveError(tId, e?.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-primary text-sm">
            <Plus size={14} /> Add person
          </button>
        ) : null}
      </div>

      {adding ? (
        <form
          className="card p-4 space-y-3"
          onSubmit={(e) => { e.preventDefault(); add(e.currentTarget); }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name *">
              <input name="name" required maxLength={120} autoFocus />
            </Field>
            <Field label="Email">
              <input name="email" type="email" maxLength={254} />
            </Field>
            <Field label="Role">
              <select name="role" defaultValue="OTHER">
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Notes">
              <input name="notes" maxLength={500} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="btn">Cancel</button>
            <button type="submit" className="btn btn-primary">Add</button>
          </div>
        </form>
      ) : null}

      {people.length === 0 ? (
        <div className="card p-12 text-center text-ink-mute">
          No one tracked yet. Add your first founder, partner, or investor.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 text-ink-dim text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Role</th>
                <th className="text-right px-3 py-2 font-medium">Portfolio (vested)</th>
                <th className="text-left px-3 py-2 font-medium">Email</th>
                <th className="text-left px-3 py-2 font-medium">Notes</th>
                <th className="text-right px-3 py-2 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => editing?.id === p.id ? (
                <tr key={p.id} className="border-t border-line/60 bg-bg-2/40">
                  <td colSpan={6} className="p-3">
                    <form
                      className="grid grid-cols-1 md:grid-cols-5 gap-2"
                      onSubmit={(e) => { e.preventDefault(); save(e.currentTarget, p); }}
                    >
                      <input name="name" defaultValue={p.name} required maxLength={120} className="text-xs" />
                      <select name="role" defaultValue={p.role} className="text-xs">
                        {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <input name="email" defaultValue={p.email || ''} type="email" maxLength={254} className="text-xs" />
                      <input name="notes" defaultValue={p.notes || ''} maxLength={500} className="text-xs" />
                      <div className="flex gap-1 justify-end">
                        <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost text-xs">Cancel</button>
                        <button type="submit" className="btn btn-primary text-xs">Save</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-t border-line/60 hover:bg-bg-2/40">
                  <td className="px-3 py-2 font-medium">
                    <Link href={`/team/${p.id}`} className="hover:text-entity-bytes">{p.name}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="pill text-xs"
                      style={{
                        background: `${roleConfig(p.role).color}1f`,
                        color: roleConfig(p.role).color,
                        border: `1px solid ${roleConfig(p.role).color}40`,
                      }}
                    >
                      {roleConfig(p.role).label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right mono tabnum">
                    {portfolioMap[p.id] ? <span className="text-income">{fmtCents(portfolioMap[p.id])}</span> : <span className="text-ink-mute">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-dim">{p.email || '—'}</td>
                  <td className="px-3 py-2 text-xs text-ink-dim truncate max-w-[260px]">{p.notes || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditing(p)} className="btn btn-ghost !p-1.5" title="Edit"><Pencil size={13} /></button>
                    <button onClick={() => remove(p)} className="btn btn-ghost !p-1.5 text-expense" title="Delete"><Trash2 size={13} /></button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">{label}</div>
      <div>{children}</div>
    </label>
  );
}
