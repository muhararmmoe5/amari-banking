'use client';

import { useState } from 'react';

export default function CpaExportPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  function download() {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    window.location.href = `/api/cpa${params.toString() ? '?' + params.toString() : ''}`;
  }

  return (
    <div className="p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">CPA export</h1>
        <p className="text-sm text-ink-dim mt-1">
          Generates a single Excel workbook your accountant can open directly. Includes summaries, breakdowns, 1099 list, wires, Spacetel flow, full ledger, and a "Needs Review" tab for anything still untagged.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Period from</div>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full" />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Period to</div>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full" />
          </label>
        </div>
        <p className="text-xs text-ink-mute">Leave both empty to export everything.</p>

        <div className="border-t border-line pt-4">
          <h3 className="text-sm font-medium mb-2">Workbook contents</h3>
          <ol className="text-xs text-ink-dim space-y-1 list-decimal pl-5">
            <li>Cover Sheet — portfolio summary</li>
            <li>By Account — income, expenses, net per Chase account</li>
            <li>By Entity — rolled-up P&L per business</li>
            <li>Income Breakdown — sources × entities</li>
            <li>Expense Breakdown — entities × categories</li>
            <li>Contractor 1099 List — Zelle recipients ≥ $600</li>
            <li>Wires &amp; International — all wires with doc status</li>
            <li>Spacetel Flow — receipts &amp; same-day outflows</li>
            <li>Full Ledger — confirmed transactions</li>
            <li>Needs Review — anything still untagged</li>
          </ol>
        </div>

        <button className="btn btn-primary w-full justify-center" onClick={download}>
          ⬇ Download CPA package (.xlsx)
        </button>
      </div>
    </div>
  );
}
