'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Pencil, Send, Copy, Check, Key } from 'lucide-react';
import type { Person, PersonRole } from '@/types/cap';
import { actCreatePerson, actUpdatePerson, actDeletePerson, actCreateInvite } from '../cap/actions';
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

interface InviteResult { personId: string; url: string; expiresAt: number; copied: boolean; kind: 'invite' | 'reset' }

export default function TeamClient({ initialPeople, portfolioMap }: { initialPeople: Person[]; portfolioMap: Record<string, number> }) {
  const [people, setPeople] = useState(initialPeople);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [inviting, setInviting] = useState<Person | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [, startTx] = useTransition();
  const { toast, saveStart, saveEnd, saveError } = useToast();

  async function generateInvite(person: Person, form: HTMLFormElement) {
    const fd = new FormData(form);
    const email = String(fd.get('email') || '').trim();
    if (!email) { toast({ kind: 'err', title: 'Email required' }); return; }
    const role = (String(fd.get('role') || 'PARTNER') as 'EDITOR' | 'PARTNER' | 'TEAM_MEMBER' | 'OBSERVER');
    // OBSERVER isn't a real auth role — collapse to TEAM_MEMBER (read-only view).
    const safeRole = role === 'OBSERVER' ? 'TEAM_MEMBER' : role;
    const tId = saveStart();
    startTx(async () => {
      try {
        const res = await actCreateInvite(person.id, email, safeRole);
        if ('error' in res) { saveError(tId, res.error); return; }
        setInviteResult({ personId: person.id, url: res.url, expiresAt: res.expiresAt, copied: false, kind: 'invite' });
        setInviting(null);
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  async function generatePasswordReset(person: Person) {
    if (!person.email) {
      toast({ kind: 'err', title: 'Add an email to this person first' });
      return;
    }
    if (!confirm(`Generate a password reset link for ${person.name}? Their current password will keep working until they open the link and set a new one.`)) {
      return;
    }
    const tId = saveStart();
    startTx(async () => {
      try {
        const res = await actCreateInvite(person.id, person.email!, 'PARTNER');
        if ('error' in res) { saveError(tId, res.error); return; }
        setInviteResult({ personId: person.id, url: res.url, expiresAt: res.expiresAt, copied: false, kind: 'reset' });
        saveEnd(tId);
      } catch (e: any) { saveError(tId, e?.message); }
    });
  }

  async function copyInvite() {
    if (!inviteResult) return;
    try {
      await navigator.clipboard.writeText(inviteResult.url);
      setInviteResult({ ...inviteResult, copied: true });
      toast({ kind: 'ok', title: 'Invite link copied' });
    } catch {
      toast({ kind: 'err', title: 'Could not copy — select the link and copy manually' });
    }
  }

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

      {inviting ? (
        <form
          className="card p-4 space-y-3 border-entity-bytes/40"
          onSubmit={(e) => { e.preventDefault(); generateInvite(inviting, e.currentTarget); }}
        >
          <h3 className="text-sm font-medium">Generate invite link for {inviting.name}</h3>
          <p className="text-xs text-ink-dim">They&apos;ll set their own password and sign in. The link is valid for 14 days.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Email</div>
              <input name="email" type="email" required defaultValue={inviting.email || ''} className="w-full" autoFocus />
            </label>
            <label className="block">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Role</div>
              <select name="role" defaultValue="TEAM_MEMBER">
                <option value="EDITOR">Admin — full access, same as you</option>
                <option value="TEAM_MEMBER">Team member — Identify queue + edit own claimed charges</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setInviting(null)} className="btn">Cancel</button>
            <button type="submit" className="btn btn-primary"><Send size={13} /> Generate link</button>
          </div>
        </form>
      ) : null}

      {inviteResult ? (
        <div className="card p-4 space-y-2 border-entity-bytes/40">
          <h3 className="text-sm font-medium">
            {inviteResult.kind === 'reset' ? 'Password reset link ready' : 'Invite link ready'}
          </h3>
          <p className="text-xs text-ink-dim">
            {inviteResult.kind === 'reset'
              ? 'Send this link to them. When they open it they\'ll set a new password and the old one stops working. Single-use, so don\'t post publicly.'
              : 'Copy this link and send it to them however you like (email, text, Slack). Anyone with the link can claim it once, so don\'t post publicly.'}
          </p>
          <div className="flex items-center gap-2">
            <input readOnly value={inviteResult.url} className="flex-1 mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button onClick={copyInvite} className="btn btn-primary">
              {inviteResult.copied ? <Check size={13} /> : <Copy size={13} />}
              {inviteResult.copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={() => setInviteResult(null)} className="btn btn-ghost">Done</button>
          </div>
          <p className="text-[11px] text-ink-mute">Expires {new Date(inviteResult.expiresAt).toLocaleDateString()}.</p>
        </div>
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
                    <button onClick={() => setInviting(p)} className="btn btn-ghost !p-1.5 text-entity-bytes" title="Generate invite link"><Send size={13} /></button>
                    <button onClick={() => generatePasswordReset(p)} className="btn btn-ghost !p-1.5" title={p.email ? 'Reset password' : 'Add an email first, then reset password'}><Key size={13} /></button>
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
