'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Mail, User as UserIcon, X } from 'lucide-react';

export interface Person {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

/** Picker that lists existing people and lets the user create a new one
 *  inline (name + optional email). Persists via /api/people POST. The
 *  picker is value-by-name (the consumer stores the person's name in its
 *  text field) so it drops into the existing `individual` columns cleanly. */
export default function PersonPicker({
  value,
  onChange,
  placeholder = 'Pick or add a person',
  compact = false,
}: {
  value: string;
  onChange: (name: string, person?: Person) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setError(null);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/people', { credentials: 'same-origin' });
      const d = await r.json();
      setPeople(d.people || []);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (open && people.length === 0 && !loading) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  async function saveNew() {
    const name = newName.trim();
    if (!name) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/people', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name, email: newEmail.trim() || null }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || `http_${r.status}`);
      }
      const d = await r.json();
      const p: Person = d.person;
      setPeople((cur) => [...cur, p].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(p.name, p);
      setAdding(false);
      setNewName('');
      setNewEmail('');
      setOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const filtered = query
    ? people.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || (p.email || '').toLowerCase().includes(query.toLowerCase()))
    : people;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left"
        style={{
          height: compact ? 30 : 34,
          padding: compact ? '0 8px' : '0 10px',
          fontSize: 12,
          background: 'var(--bg-3)',
          border: '0.5px solid var(--border-default, rgba(255,255,255,0.12))',
          borderRadius: 7,
          color: value ? 'var(--ink)' : 'var(--ink-3)',
        }}
      >
        <UserIcon size={11} className="text-ink-mute shrink-0" />
        <span className="flex-1 truncate">
          {value || placeholder}
        </span>
        {value ? (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-ink-mute hover:text-expense"
            title="Clear"
          >
            <X size={11} />
          </span>
        ) : null}
        <ChevronDown size={11} className="text-ink-mute shrink-0" />
      </button>

      {open ? (
        <div
          className="absolute z-50 left-0 right-0 mt-1"
          style={{
            background: 'var(--bg-2)',
            border: '0.5px solid var(--border-default, rgba(255,255,255,0.16))',
            borderRadius: 8,
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.6)',
            maxHeight: 320,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {!adding ? (
            <>
              <div style={{ padding: 8, borderBottom: '0.5px solid var(--border-subtle)' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ fontSize: 12, height: 28 }}
                />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {loading ? (
                  <div className="text-[11px] text-ink-mute p-3">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="text-[11px] text-ink-mute p-3">
                    {query ? `No match for "${query}"` : 'No people yet.'}
                  </div>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { onChange(p.name, p); setOpen(false); }}
                      className="block w-full text-left hover:bg-bg-3 transition"
                      style={{ padding: '7px 12px', fontSize: 12 }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: 'var(--ink)' }}>{p.name}</span>
                        <span className="text-[10px] text-ink-mute">· {p.role.toLowerCase()}</span>
                      </div>
                      {p.email ? (
                        <div className="text-[10px] text-ink-mute mt-px inline-flex items-center gap-1">
                          <Mail size={9} /> {p.email}
                        </div>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => { setAdding(true); setNewName(query); }}
                style={{
                  padding: '8px 12px',
                  fontSize: 12,
                  borderTop: '0.5px solid var(--border-subtle)',
                  background: 'rgba(201,168,122,0.08)',
                  color: 'var(--gold)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={11} /> Add new person{query ? ` "${query}"` : ''}
              </button>
            </>
          ) : (
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="field-label" style={{ marginBottom: 0 }}>New person</div>
              <input
                autoFocus
                type="text"
                placeholder="Full name (required)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ fontSize: 12, height: 30 }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNew(); }}
              />
              <input
                type="email"
                placeholder="Email (optional — for invite later)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                style={{ fontSize: 12, height: 30 }}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNew(); }}
              />
              {error ? (
                <div className="text-[10.5px]" style={{ color: 'var(--expense)' }}>{error}</div>
              ) : null}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setError(null); }}
                  className="btn btn-sm btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveNew}
                  disabled={saving || !newName.trim()}
                  className="btn btn-sm btn-primary"
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Saving…' : 'Save & tag'}
                </button>
              </div>
              <div className="text-[10px] text-ink-mute">
                Adds them to your People list. You can send an email invite from the Team page later.
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
