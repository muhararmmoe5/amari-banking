'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

interface Props {
  field: string;
  value: string;
  options: string[];
  /** Read-only options sourced from somewhere else (people list, entity list, etc.).
   *  Shown above the user-managed custom options under a group label. */
  builtInOptions?: { label: string; values: string[] };
  /** Optional extra groups rendered AFTER the primary options. Use for the
   *  "scroll past to find other categories" pattern. */
  secondaryGroups?: { label: string; values: string[] }[];
  /** Parent value to pass through when the user creates a new option inline. */
  newOptionParent?: string | null;
  onChange: (v: string) => void;
  onOptionAdded?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Select dropdown whose options are managed in /admin/options.
 * Last item is "+ Add new…" which prompts for a new value, POSTs it
 * to /api/options, and selects it.
 */
export default function OptionSelect({
  field, value, options, builtInOptions, secondaryGroups, newOptionParent, onChange, onOptionAdded, placeholder = '— pick —', disabled,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    const v = window.prompt('New option value:');
    if (!v || !v.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ field, value: v.trim(), parent: newOptionParent || null }),
      });
      const d = await r.json();
      if (r.ok && d.option) {
        onOptionAdded?.(d.option.value);
        onChange(d.option.value);
      } else {
        alert('Could not add option: ' + (d?.error || r.statusText));
      }
    } catch (e: any) {
      alert('Network error: ' + (e?.message || 'failed'));
    } finally {
      setBusy(false);
    }
  }

  // Render: when an option list is present, show <select>. We append a "+ Add new" sentinel option.
  return (
    <div className="flex gap-1">
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === '__ADD_NEW__') { handleAdd(); return; }
          onChange(e.target.value);
        }}
        className="w-full"
        disabled={disabled || busy}
      >
        <option value="">{placeholder}</option>
        {value && !options.includes(value) && !builtInOptions?.values.includes(value) ? (
          <option value={value}>{value} (custom)</option>
        ) : null}
        {builtInOptions && builtInOptions.values.length > 0 ? (
          <optgroup label={builtInOptions.label}>
            {builtInOptions.values.map((o) => <option key={`builtin-${o}`} value={o}>{o}</option>)}
          </optgroup>
        ) : null}
        {options.length > 0 ? (
          <optgroup label={builtInOptions ? 'Custom options' : 'Options'}>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </optgroup>
        ) : null}
        {secondaryGroups && secondaryGroups.length > 0 ? (
          <>
            <option disabled>──── Other categories ────</option>
            {secondaryGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.values.map((o) => <option key={`${g.label}-${o}`} value={o}>{o}</option>)}
              </optgroup>
            ))}
          </>
        ) : null}
        <option value="__ADD_NEW__">＋ Add new option…</option>
      </select>
    </div>
  );
}
