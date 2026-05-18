'use client';

import { useState, useTransition } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { ENTITY_LABELS, BUSINESS_ENTITIES } from '@/constants/accounts';
import { createSalaryAction } from './actions';
import type { Person } from '@/types/cap';

export default function SalaryEditor({ people }: { people: Person[] }) {
  const { saveStart, saveEnd, saveError } = useToast();
  const [open, setOpen] = useState(false);
  const [personId, setPersonId] = useState(people[0]?.id || '');
  const [entity, setEntity] = useState<string>(BUSINESS_ENTITIES[0]);
  const [kind, setKind] = useState('SALARY');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [, startTx] = useTransition();
  const [saving, setSaving] = useState(false);

  function reset() {
    setPersonId(people[0]?.id || '');
    setEntity(BUSINESS_ENTITIES[0]);
    setKind('SALARY');
    setAmount('');
    setLabel('');
    setOpen(false);
  }

  function save() {
    const num = Number(String(amount).replace(/[^0-9.\-]/g, ''));
    if (!personId) { saveError(saveStart(), 'Pick a person'); return; }
    if (!Number.isFinite(num) || num <= 0) { saveError(saveStart(), 'Enter a monthly amount'); return; }
    setSaving(true);
    const tId = saveStart();
    startTx(async () => {
      try {
        await createSalaryAction({
          personId,
          entity,
          kind: kind as any,
          monthlyAmountCents: Math.round(num * 100),
          label: label || null,
        });
        saveEnd(tId);
        reset();
      } catch (e: any) {
        saveError(tId, e?.message || 'Failed to save');
      } finally {
        setSaving(false);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-primary"
        >
          <Plus size={12} /> Add salary
        </button>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="field-label" style={{ marginBottom: 12 }}>New salary</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div>
          <div className="field-label" style={{ marginBottom: 4 }}>Person</div>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="text-xs">
            {people.length === 0 ? (
              <option value="">— no people yet —</option>
            ) : null}
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="field-label" style={{ marginBottom: 4 }}>Entity</div>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="text-xs">
            {BUSINESS_ENTITIES.map((k) => (
              <option key={k} value={k}>{(ENTITY_LABELS as any)[k]}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="field-label" style={{ marginBottom: 4 }}>Kind</div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="text-xs">
            <option value="SALARY">Salary (W-2)</option>
            <option value="CONTRACTOR">Contractor (1099)</option>
            <option value="HOUSING">Housing stipend</option>
            <option value="STIPEND">General stipend</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <div className="field-label" style={{ marginBottom: 4 }}>Monthly amount</div>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5500"
            className="num text-xs"
          />
        </div>
        <div>
          <div className="field-label" style={{ marginBottom: 4 }}>Label (optional)</div>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Total comp incl. apartment"
            className="text-xs"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" onClick={reset} className="btn btn-sm btn-ghost">Cancel</button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn btn-sm btn-primary"
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save salary'}
        </button>
      </div>
    </div>
  );
}
