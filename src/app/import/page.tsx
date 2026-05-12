'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { isInternalTransfer } from '@/lib/parsers/categorizer';
import { detectAccountFromFilename } from '@/lib/parsers/csv';
import { ACCOUNTS, ENTITY_LABELS } from '@/constants/accounts';
import { importCsvFiles, type ImportRunResult } from './actions';
import { Money } from '@/components/Money';
import { EntityBadge } from '@/components/EntityBadge';

interface PendingFile {
  filename: string;
  csvText: string;
  detectedAccountId: string | null;
  selectedAccountId: string | null;
  rowsPreview: { date: string; description: string; amount: number; type: string; isInternal: boolean }[];
  totalRows: number;
}

export default function ImportPage() {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ perFile: ImportRunResult[]; reconciled: number; ambiguousMatches: number } | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    const incoming: PendingFile[] = [];
    for (const file of accepted) {
      const csvText = await file.text();
      const detected = detectAccountFromFilename(file.name);
      let totalRows = 0;
      const rowsPreview: PendingFile['rowsPreview'] = [];
      Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (parsed) => {
          totalRows = parsed.data.length;
          parsed.data.slice(0, 5).forEach((r) => {
            const amount = parseFloat((r['Amount'] || '0').replace(/[,$]/g, ''));
            rowsPreview.push({
              date: (r['Posting Date'] || '').trim(),
              description: (r['Description'] || '').trim(),
              amount: isNaN(amount) ? 0 : amount,
              type: r['Type'] || '',
              isInternal: isInternalTransfer(r['Description'] || '', r['Type'] || ''),
            });
          });
        },
      });
      incoming.push({
        filename: file.name,
        csvText,
        detectedAccountId: detected,
        selectedAccountId: detected,
        rowsPreview,
        totalRows,
      });
    }
    setPending((prev) => [...prev, ...incoming]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv', '.CSV'] },
    multiple: true,
  });

  function updateAccount(idx: number, accountId: string) {
    setPending((p) => p.map((f, i) => (i === idx ? { ...f, selectedAccountId: accountId || null } : f)));
  }
  function removeFile(idx: number) {
    setPending((p) => p.filter((_, i) => i !== idx));
  }

  async function doImport() {
    if (pending.length === 0) return;
    if (pending.some((p) => !p.selectedAccountId)) {
      alert('Please select an account for every file.');
      return;
    }
    setBusy(true);
    try {
      const res = await importCsvFiles(
        pending.map((p) => ({
          filename: p.filename,
          csvText: p.csvText,
          accountId: p.selectedAccountId!,
        }))
      );
      setResult(res);
      setPending([]);
    } catch (e: any) {
      alert('Import failed: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import CSV</h1>
        <p className="text-sm text-ink-dim mt-1">
          Drop your Chase CSV exports. We auto-detect the account from the filename (e.g. <code className="mono text-ink">Chase0320_Activity_*.CSV</code>) and run full categorization before saving.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`card p-12 text-center cursor-pointer transition border-2 border-dashed ${
          isDragActive ? 'border-entity-bytes bg-entity-bytes/5' : 'border-line hover:border-entity-bytes/40'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-3xl mb-2">⬆</div>
        <div className="font-medium">{isDragActive ? 'Drop the CSVs here' : 'Drag CSV files here or click to browse'}</div>
        <div className="text-xs text-ink-mute mt-1">Chase format: Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #</div>
      </div>

      {pending.length > 0 ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wider text-ink-dim">Ready to import ({pending.length} file{pending.length === 1 ? '' : 's'})</h2>
            <div className="flex gap-2">
              <button className="btn" onClick={() => setPending([])} disabled={busy}>Clear</button>
              <button className="btn btn-primary" onClick={doImport} disabled={busy}>
                {busy ? 'Importing…' : 'Import all'}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {pending.map((p, idx) => {
              const acct = ACCOUNTS.find((a) => a.id === p.selectedAccountId);
              return (
                <div key={idx} className="border border-line rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm">{p.filename}</div>
                      <div className="text-xs text-ink-mute mt-1">{p.totalRows} rows</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={p.selectedAccountId || ''}
                        onChange={(e) => updateAccount(idx, e.target.value)}
                      >
                        <option value="">Select account…</option>
                        {ACCOUNTS.map((a) => (
                          <option key={a.id} value={a.id}>
                            ···{a.last4} — {a.label}
                          </option>
                        ))}
                      </select>
                      {acct ? <EntityBadge entity={acct.entity} size="xs" /> : null}
                      <button className="btn btn-ghost text-ink-dim" onClick={() => removeFile(idx)} disabled={busy}>×</button>
                    </div>
                  </div>
                  {p.rowsPreview.length > 0 ? (
                    <div className="mt-3 text-xs">
                      <div className="text-ink-mute mb-1">Preview (first 5)</div>
                      <table className="w-full">
                        <thead>
                          <tr className="text-ink-mute text-left">
                            <th className="font-normal pr-3">Date</th>
                            <th className="font-normal pr-3">Description</th>
                            <th className="font-normal pr-3 text-right">Amount</th>
                            <th className="font-normal">Internal?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.rowsPreview.map((r, i) => (
                            <tr key={i} className="border-t border-line/60">
                              <td className="py-1 pr-3 mono">{r.date}</td>
                              <td className="py-1 pr-3 truncate max-w-[420px]">{r.description}</td>
                              <td className="py-1 pr-3 text-right"><Money value={r.amount} /></td>
                              <td className="py-1">{r.isInternal ? '✓' : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="card p-5">
          <h2 className="text-sm uppercase tracking-wider text-ink-dim mb-3">Import summary</h2>
          <div className="space-y-2 text-sm">
            {result.perFile.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 first:border-t-0 pt-2 first:pt-0">
                <div>
                  <span className="mono">{r.filename}</span>
                  <span className="text-ink-mute"> · ···{r.accountId || '?'} </span>
                </div>
                <div className="text-xs text-ink-dim">
                  {r.errors.length > 0 ? (
                    <span className="text-expense">Errors: {r.errors.join(', ')}</span>
                  ) : (
                    <span>
                      <strong className="text-ink">{r.inserted}</strong> inserted ·{' '}
                      <strong className="text-ink-dim">{r.duplicates}</strong> duplicates skipped
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div className="border-t border-line/60 pt-3 mt-3 text-sm text-ink-dim">
              <strong className="text-ink">{result.reconciled}</strong> internal transfers matched.
              {result.ambiguousMatches > 0 ? (
                <span className="ml-2 text-warn">{result.ambiguousMatches} ambiguous (lower confidence)</span>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <a className="btn btn-primary" href="/transactions">View transactions →</a>
            <a className="btn" href="/audit">Start audit review →</a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
