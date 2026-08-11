'use server';

import { revalidatePath } from 'next/cache';
import { parseChaseCsv } from '@/lib/parsers/csv';
import { saveImportBatch } from '@/lib/db/queries';
import { runReconciliation } from '@/lib/parsers/reconciler';
import { requireUser, hasEditAccess } from '@/lib/auth';

export interface ImportFilePayload {
  filename: string;
  csvText: string;
  accountId?: string;
}

export interface ImportRunResult {
  filename: string;
  accountId: string | null;
  parsed: number;
  inserted: number;
  duplicates: number;
  errors: string[];
}

export async function importCsvFiles(files: ImportFilePayload[]): Promise<{
  perFile: ImportRunResult[];
  reconciled: number;
  ambiguousMatches: number;
}> {
  const user = requireUser();
  if (!hasEditAccess(user)) throw new Error('read-only role cannot import');
  const perFile: ImportRunResult[] = [];
  for (const f of files) {
    const parsed = parseChaseCsv(f.csvText, f.filename, f.accountId);
    if (parsed.errors.length > 0 || !parsed.accountId) {
      perFile.push({
        filename: f.filename,
        accountId: parsed.accountId,
        parsed: parsed.rowCount,
        inserted: 0,
        duplicates: 0,
        errors: parsed.errors.length ? parsed.errors : ['Missing account id'],
      });
      continue;
    }
    const saved = saveImportBatch(parsed.filename, parsed.accountId, parsed.rows);
    perFile.push({
      filename: f.filename,
      accountId: parsed.accountId,
      parsed: parsed.rowCount,
      inserted: saved.inserted,
      duplicates: saved.duplicates,
      errors: [],
    });
  }
  const recon = runReconciliation();
  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/audit');
  return { perFile, reconciled: recon.matched, ambiguousMatches: recon.ambiguous };
}
