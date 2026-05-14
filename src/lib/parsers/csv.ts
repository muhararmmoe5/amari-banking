import Papa from 'papaparse';
import { categorize } from './categorizer';
import type { ParsedTransaction } from '@/types';

export function detectAccountFromFilename(filename: string): string | null {
  // Chase0320_Activity_20260511.CSV → "0320"
  const m1 = filename.match(/Chase(\d+)_Activity/i);
  if (m1) return m1[1].slice(-4).padStart(4, '0');
  // fallback: any 4-digit sequence in name
  const m2 = filename.match(/(\d{4})/);
  return m2 ? m2[1] : null;
}

function normalizeDate(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  // MM/DD/YYYY → YYYY-MM-DD
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  // YYYY-MM-DD passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // ISO
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return trimmed;
}

function parseAmount(s: string | number | undefined): number | null {
  if (s === undefined || s === null || s === '') return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const cleaned = String(s).replace(/[,$\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface CsvParseResult {
  accountId: string | null;
  filename: string;
  rows: ParsedTransaction[];
  rowCount: number;
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
  errors: string[];
}

export function parseChaseCsv(csvText: string, filename: string, overrideAccountId?: string): CsvParseResult {
  const errors: string[] = [];
  const accountId = overrideAccountId || detectAccountFromFilename(filename);

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (result.errors && result.errors.length > 0) {
    for (const e of result.errors) {
      // FieldMismatch (extra/missing columns) is non-fatal: Papa still gives us the row data.
      // Chase exports sometimes have a trailing empty column or an extra Memo field.
      if (e.code === 'TooManyFields' || e.code === 'TooFewFields' || e.type === 'FieldMismatch') continue;
      errors.push(`Row ${e.row ?? '?'}: ${e.message}`);
    }
  }
  if (!accountId) {
    errors.push('Could not detect account from filename — please select it manually.');
  }

  const rows: ParsedTransaction[] = [];
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const raw of result.data) {
    const description = (raw['Description'] || '').trim();
    const amount = parseAmount(raw['Amount']);
    const postingDate = normalizeDate(raw['Posting Date'] || '');
    const type = (raw['Type'] || '').trim();
    const balance = parseAmount(raw['Balance']);

    if (amount === null || !description || !postingDate) continue;
    if (!accountId) continue;

    const cat = categorize(description, amount, accountId, type);
    rows.push({
      accountId,
      postingDate,
      description,
      amount,
      type,
      balance,
      category: cat.category,
      entityTag: cat.entityTag,
      isInternal: cat.isInternal,
      merchantName: cat.merchantName,
      auditFlags: cat.auditFlags,
      auditScore: cat.auditScore,
      incomeSource: cat.incomeSource,
      zellePerson: cat.zellePerson,
      zelleType: cat.zelleType,
      suggestedPurpose: cat.suggestedPurpose,
    });

    if (!minDate || postingDate < minDate) minDate = postingDate;
    if (!maxDate || postingDate > maxDate) maxDate = postingDate;
  }

  return {
    accountId,
    filename,
    rows,
    rowCount: rows.length,
    dateRangeFrom: minDate,
    dateRangeTo: maxDate,
    errors,
  };
}
