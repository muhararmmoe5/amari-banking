import 'server-only';
import crypto from 'crypto';
import { getDb } from './index';

export const OPTION_FIELDS = [
  'individual',
  'sub_category_1',
  'sub_category_2',
  'business_purpose',
  'source_of_money',
  'need_to_get_from',
] as const;

export type OptionField = typeof OPTION_FIELDS[number];

export const OPTION_FIELD_LABELS: Record<OptionField, string> = {
  individual: 'Individual (who is this about)',
  sub_category_1: 'Sub category 1',
  sub_category_2: 'Sub category 2',
  business_purpose: 'Business purpose',
  source_of_money: 'Source of money to pay',
  need_to_get_from: 'Need to get from',
};

export interface FieldOption {
  id: string;
  field: OptionField;
  value: string;
  sortOrder: number;
  createdAt: number;
}

function rowToOption(r: any): FieldOption {
  return { id: r.id, field: r.field, value: r.value, sortOrder: r.sort_order, createdAt: r.created_at };
}

export function listOptions(field?: OptionField): FieldOption[] {
  const db = getDb();
  const rows = field
    ? (db.prepare('SELECT * FROM field_options WHERE field = ? ORDER BY sort_order, value COLLATE NOCASE').all(field) as any[])
    : (db.prepare('SELECT * FROM field_options ORDER BY field, sort_order, value COLLATE NOCASE').all() as any[]);
  return rows.map(rowToOption);
}

export function listOptionsGrouped(): Record<OptionField, FieldOption[]> {
  const all = listOptions();
  const out = {} as Record<OptionField, FieldOption[]>;
  for (const f of OPTION_FIELDS) out[f] = [];
  for (const o of all) {
    if ((OPTION_FIELDS as readonly string[]).includes(o.field)) out[o.field as OptionField].push(o);
  }
  return out;
}

export function createOption(field: OptionField, value: string): FieldOption | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const db = getDb();
  const id = crypto.randomUUID();
  const now = Date.now();
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM field_options WHERE field = ?').get(field) as any).m;
  db.prepare(
    'INSERT INTO field_options (id, field, value, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, field, trimmed, maxOrder + 1, now);
  const r = db.prepare('SELECT * FROM field_options WHERE field = ? AND value = ?').get(field, trimmed) as any;
  return r ? rowToOption(r) : null;
}

export function deleteOption(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM field_options WHERE id = ?').run(id);
}

export function renameOption(id: string, value: string): void {
  const v = value.trim();
  if (!v) return;
  const db = getDb();
  db.prepare('UPDATE field_options SET value = ? WHERE id = ?').run(v, id);
}
