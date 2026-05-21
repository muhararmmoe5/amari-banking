'use client';

import { useState } from 'react';

type Result = { conference: string; sids: Record<string, string> } | { error: string };

export default function ThreeWayPage() {
  const [initiator, setInitiator] = useState('');
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/voice/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ initiator, partyA, partyB }),
      });
      const json = await res.json();
      setResult(json);
    } catch (err: any) {
      setResult({ error: err?.message || 'request failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-semibold mb-1">3way</h1>
        <p className="text-slate-400 text-sm mb-8">
          Bridges three phones into a conference. Your line joins muted.
        </p>

        <form onSubmit={start} className="space-y-4">
          <Field
            label="Your number"
            value={initiator}
            onChange={setInitiator}
            placeholder="+15551234567"
          />
          <Field
            label="Party A"
            value={partyA}
            onChange={setPartyA}
            placeholder="+15551234567"
          />
          <Field
            label="Party B"
            value={partyB}
            onChange={setPartyB}
            placeholder="+15551234567"
          />

          <button
            type="submit"
            disabled={loading || !initiator || !partyA || !partyB}
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-semibold py-3 transition"
          >
            {loading ? 'Dialing…' : 'Connect call'}
          </button>
        </form>

        {result && (
          <pre className="mt-6 text-xs bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-300 mb-1">{label}</span>
      <input
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-0 px-3 py-2 outline-none"
      />
    </label>
  );
}
