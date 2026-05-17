'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { useToast } from '@/components/Toast';
import type { OptionField, FieldOption } from '@/lib/db/options';
import { actCreateOption, actDeleteOption, actRenameOption } from './actions';

export default function OptionsClient({
  fields,
}: {
  fields: { field: OptionField; label: string; options: FieldOption[]; autoNote?: string }[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((f) => (
        <FieldCard key={f.field} field={f.field} label={f.label} options={f.options} autoNote={f.autoNote} />
      ))}
    </div>
  );
}

function FieldCard({ field, label, options, autoNote }: { field: OptionField; label: string; options: FieldOption[]; autoNote?: string }) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [, startTx] = useTransition();
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newValue.trim()) return;
    const tid = saveStart();
    startTx(async () => {
      try {
        await actCreateOption(field, newValue);
        saveEnd(tid);
        setNewValue('');
      } catch (err: any) { saveError(tid, err?.message || 'failed'); }
    });
  }

  function onDelete(id: string) {
    if (!confirm('Delete this option? Transactions already tagged with this value will keep the text but it will no longer appear in the dropdown.')) return;
    const tid = saveStart();
    startTx(async () => {
      try { await actDeleteOption(id); saveEnd(tid); }
      catch (err: any) { saveError(tid, err?.message || 'failed'); }
    });
  }

  function startEdit(o: FieldOption) {
    setEditingId(o.id);
    setEditingValue(o.value);
  }

  function commitEdit() {
    if (!editingId) return;
    const tid = saveStart();
    const id = editingId;
    const value = editingValue;
    startTx(async () => {
      try { await actRenameOption(id, value); saveEnd(tid); }
      catch (err: any) { saveError(tid, err?.message || 'failed'); }
    });
    setEditingId(null);
  }

  return (
    <div className="card p-4">
      <div className="text-sm font-medium mb-2">{label}</div>
      {autoNote ? (
        <div className="text-[11px] text-warn mb-2 bg-warn/5 border border-warn/20 rounded px-2 py-1.5">{autoNote}</div>
      ) : null}
      <div className="text-[11px] text-ink-mute mb-3">{options.length} custom option{options.length === 1 ? '' : 's'}</div>
      <form onSubmit={onAdd} className="flex items-center gap-2 mb-3">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Add new option…"
          className="flex-1"
        />
        <button type="submit" className="btn btn-primary inline-flex items-center gap-1">
          <Plus size={12} /> Add
        </button>
      </form>
      {options.length === 0 ? (
        <div className="text-xs text-ink-mute italic">No options yet — add a few above.</div>
      ) : (
        <ul className="divide-y divide-line/60 -mx-4">
          {options.map((o) => (
            <li key={o.id} className="px-4 py-2 flex items-center gap-2">
              {editingId === o.id ? (
                <>
                  <input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                      if (e.key === 'Escape') { setEditingId(null); }
                    }}
                  />
                  <button type="button" onClick={commitEdit} className="text-income p-1 hover:bg-bg-2 rounded"><Check size={14} /></button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-ink-mute p-1 hover:bg-bg-2 rounded"><X size={14} /></button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => startEdit(o)} className="flex-1 text-left text-sm hover:text-ink-mute truncate">{o.value}</button>
                  <button type="button" onClick={() => onDelete(o.id)} className="text-flag-critText p-1 hover:bg-bg-2 rounded"><Trash2 size={12} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
