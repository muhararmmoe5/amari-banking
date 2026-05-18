import 'server-only';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import type { Anthropic } from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';
import {
  listTransactions,
  type ListFilters,
} from '@/lib/db/queries';
import { getAccount, ENTITY_LABELS } from '@/constants/accounts';
import type { Transaction, EntityType, CategoryType, AuditStatus } from '@/types';

// ===== Temporary CSV store =====
interface StoredCsv { csv: string; filename: string; createdAt: number }
const csvStore = new Map<string, StoredCsv>();
const CSV_TTL_MS = 10 * 60 * 1000;

function pruneCsv() {
  const now = Date.now();
  for (const [id, v] of csvStore) {
    if (now - v.createdAt > CSV_TTL_MS) csvStore.delete(id);
  }
}

export function getStoredCsv(id: string): StoredCsv | undefined {
  pruneCsv();
  return csvStore.get(id);
}

// ===== Filter normalization (shared by tools) =====
const FILTER_PROPS = {
  account_id: { type: 'string', description: '4-digit account number, e.g. "0320"' },
  entity: {
    type: 'string',
    enum: ['BYTES_AI','ROCKET_WIRELESS','DELICIOUS_BYTES','AMARI_VENTURES','BYTES_REST_TECH','AMARI_HOLDINGS','PERSONAL','MULTI_ENTITY','BUSINESS_SHARED','UNKNOWN'],
    description: 'Filter by confirmed_entity (falls back to auto-detected entity_tag)',
  },
  category: { type: 'string', description: 'Filter by category, e.g. EXPENSE_ZELLE, INCOME_STRIPE' },
  audit_status: {
    type: 'string',
    enum: ['UNREVIEWED','TAGGED','CONFIRMED','NEEDS_RECEIPT','PERSONAL_NO_DEDUCT','DISPUTED'],
  },
  search: { type: 'string', description: 'Search description, merchant name, or zelle recipient' },
  zelle_only: { type: 'boolean', description: 'Only Zelle transactions (where zelle_person is set)' },
  wires_only: { type: 'boolean', description: 'Only wire transfers (international + domestic + remittance)' },
  income_source: {
    type: 'string',
    enum: ['SPACETEL','OMAR_ALGHAZALI','TCETRA','VIDAPAY','STRIPE','DOORDASH','GRUBHUB','UBER_EATS','GUSTO','ZELLE_IN','WIRE_UNKNOWN','OTHER'],
  },
  zelle_person: { type: 'string', description: 'Filter by Zelle recipient name (substring match)' },
  min_amount: { type: 'number', description: 'Minimum signed amount in dollars' },
  max_amount: { type: 'number', description: 'Maximum signed amount in dollars' },
  date_from: { type: 'string', description: 'Earliest posting date (YYYY-MM-DD)' },
  date_to: { type: 'string', description: 'Latest posting date (YYYY-MM-DD)' },
  flagged_only: { type: 'boolean', description: 'Only unreviewed transactions with an audit flag' },
  hide_internal: { type: 'boolean', description: 'Hide internal account-to-account transfers (default true)' },
};

interface ToolFilters {
  account_id?: string;
  entity?: EntityType;
  category?: CategoryType;
  audit_status?: AuditStatus;
  search?: string;
  zelle_only?: boolean;
  wires_only?: boolean;
  income_source?: string;
  zelle_person?: string;
  min_amount?: number;
  max_amount?: number;
  date_from?: string;
  date_to?: string;
  flagged_only?: boolean;
  hide_internal?: boolean;
}

function buildSql(filters: ToolFilters): { where: string; params: Record<string, unknown> } {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filters.account_id) { where.push('account_id = @account_id'); params.account_id = filters.account_id; }
  if (filters.entity) { where.push('COALESCE(confirmed_entity, entity_tag) = @entity'); params.entity = filters.entity; }
  if (filters.category) { where.push('COALESCE(confirmed_category, category) = @category'); params.category = filters.category; }
  if (filters.audit_status) { where.push('audit_status = @audit_status'); params.audit_status = filters.audit_status; }
  if (filters.search) {
    where.push('(description LIKE @search OR merchant_name LIKE @search OR zelle_person LIKE @search)');
    params.search = `%${filters.search}%`;
  }
  if (filters.zelle_only) where.push('zelle_person IS NOT NULL');
  if (filters.wires_only) where.push("category IN ('EXPENSE_WIRE_INTL','EXPENSE_WIRE_DOMESTIC','EXPENSE_REMITTANCE','INCOME_WIRE')");
  if (filters.income_source) { where.push('income_source = @income_source'); params.income_source = filters.income_source; }
  if (filters.zelle_person) { where.push('zelle_person LIKE @zelle_person'); params.zelle_person = `%${filters.zelle_person}%`; }
  if (filters.min_amount !== undefined) { where.push('amount >= @min_amount'); params.min_amount = filters.min_amount; }
  if (filters.max_amount !== undefined) { where.push('amount <= @max_amount'); params.max_amount = filters.max_amount; }
  if (filters.date_from) { where.push('posting_date >= @date_from'); params.date_from = filters.date_from; }
  if (filters.date_to) { where.push('posting_date <= @date_to'); params.date_to = filters.date_to; }
  if (filters.flagged_only) where.push("audit_status = 'UNREVIEWED' AND audit_score > 0");
  const internalDefault = filters.hide_internal !== false;
  if (internalDefault) where.push('is_internal = 0');
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ===== Tool definitions =====
export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'list_transactions',
    description:
      'Return a list of transactions matching the filters. Use for "show me…", "what are…", "find…", "list…" questions. Returns at most 50 rows plus a total count. ' +
      'Always prefer narrow filters — start with date_from/date_to or account_id if the user gave context. ' +
      'Returns each row\'s id, posting date, account, merchant, amount, category, entity, zelle_person (if any), audit_status, and audit_score.',
    input_schema: {
      type: 'object',
      properties: {
        ...FILTER_PROPS,
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
      },
    },
  },
  {
    name: 'summarize_transactions',
    description:
      'Aggregate totals grouped by entity, category, account, month, income source, Zelle recipient, or audit status. Use for "how much…", "total…", "breakdown of…", "spend by…" questions.',
    input_schema: {
      type: 'object',
      properties: {
        group_by: {
          type: 'string',
          enum: ['entity', 'category', 'account', 'month', 'income_source', 'zelle_person', 'audit_status'],
        },
        ...FILTER_PROPS,
      },
      required: ['group_by'],
    },
  },
  {
    name: 'download_csv',
    description:
      'Generate a downloadable CSV (Excel-compatible) of every transaction matching the filters. Use when the user asks to "download", "export", "save as csv", "get a csv of…", or similar. Returns a download token the user can click in the chat UI.',
    input_schema: {
      type: 'object',
      properties: {
        ...FILTER_PROPS,
        filename: { type: 'string', description: 'Optional filename (no extension). Defaults to a sensible name based on filters.' },
      },
    },
  },
  {
    name: 'navigate_to',
    description:
      'Open one of the app pages in the user\'s browser, optionally with filters applied. Use for "show me in the app", "bring up…", "open…", "go to…" requests. The page navigates inline; the chat stays open.',
    input_schema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: ['dashboard', 'transactions', 'audit', 'zelle', 'cpa', 'income', 'pl', 'accounts', 'reconcile', 'import'],
        },
        account_id: FILTER_PROPS.account_id,
        entity: FILTER_PROPS.entity,
        audit_status: FILTER_PROPS.audit_status,
        search: FILTER_PROPS.search,
        flagged_only: FILTER_PROPS.flagged_only,
        show_internal: { type: 'boolean' },
      },
      required: ['page'],
    },
  },
];

// ===== Tool executor =====
export interface ToolResult {
  // payload sent back to Claude as the tool result string
  llmText: string;
  // UI hint payload — surfaced as a card in the chat UI
  ui?:
    | { kind: 'download'; csvId: string; filename: string; rowCount: number; sizeBytes: number }
    | { kind: 'navigate'; url: string; label: string }
    | { kind: 'rows'; rows: SerializedTxRow[]; total: number; truncated: boolean }
    | { kind: 'summary'; groups: { key: string; total: number; count: number }[]; groupBy: string };
}

export interface SerializedTxRow {
  id: string;
  date: string;
  account: string;
  merchant: string;
  description: string;
  amount: number;
  category: string;
  entity: string;
  status: string;
  zellePerson: string | null;
  flagScore: number;
}

function serializeRow(t: Transaction): SerializedTxRow {
  const acct = getAccount(t.accountId);
  return {
    id: t.id,
    date: t.postingDate,
    account: `···${t.accountId}` + (acct ? ` (${acct.label})` : ''),
    merchant: t.merchantName,
    description: t.description.slice(0, 200),
    amount: t.amount,
    category: t.category,
    entity: ENTITY_LABELS[(t.confirmedEntity || t.entityTag) as EntityType] || t.entityTag,
    status: t.auditStatus,
    zellePerson: t.zellePerson,
    flagScore: t.auditScore,
  };
}

function buildPageUrl(page: string, params: Record<string, string | boolean | undefined>): string {
  const map: Record<string, string> = {
    account_id: 'account',
    audit_status: 'status',
  };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    const key = map[k] || k;
    sp.set(key, v === true ? '1' : String(v));
  }
  const qs = sp.toString();
  const base = page === 'dashboard' ? '/' : `/${page}`;
  return qs ? `${base}?${qs}` : base;
}

export async function executeTool(name: string, input: any): Promise<ToolResult> {
  switch (name) {
    case 'list_transactions': {
      const f = input as ToolFilters & { limit?: number };
      const limit = Math.min(50, Math.max(1, f.limit || 25));
      const internalDefault = f.hide_internal !== false;
      const filters: ListFilters = {
        accountId: f.account_id,
        entityTag: f.entity,
        category: f.category,
        auditStatus: f.audit_status,
        search: f.search,
        hideInternal: internalDefault,
        minAmount: f.min_amount,
        maxAmount: f.max_amount,
        dateFrom: f.date_from,
        dateTo: f.date_to,
        flaggedOnly: f.flagged_only,
        limit,
      };
      const rows = listTransactions(filters);
      // Apply post-filters that ListFilters doesn't have:
      let filtered = rows;
      if (f.zelle_only) filtered = filtered.filter((r) => r.zellePerson);
      if (f.wires_only) {
        filtered = filtered.filter((r) =>
          ['EXPENSE_WIRE_INTL', 'EXPENSE_WIRE_DOMESTIC', 'EXPENSE_REMITTANCE', 'INCOME_WIRE'].includes(r.category)
        );
      }
      if (f.income_source) filtered = filtered.filter((r) => r.incomeSource === f.income_source);
      if (f.zelle_person) {
        const needle = f.zelle_person.toLowerCase();
        filtered = filtered.filter((r) => (r.zellePerson || '').toLowerCase().includes(needle));
      }
      filtered = filtered.slice(0, limit);
      const ui: ToolResult['ui'] = {
        kind: 'rows',
        rows: filtered.map(serializeRow),
        total: filtered.length,
        truncated: filtered.length === limit,
      };
      const llmText = JSON.stringify({
        row_count: filtered.length,
        truncated: filtered.length === limit,
        total_amount: filtered.reduce((s, r) => s + r.amount, 0),
        rows: filtered.map((r) => ({
          id: r.id,
          date: r.postingDate,
          account: r.accountId,
          merchant: r.merchantName,
          amount: r.amount,
          category: r.category,
          entity: r.confirmedEntity || r.entityTag,
          zelle: r.zellePerson,
          status: r.auditStatus,
          flag_score: r.auditScore,
        })),
      });
      return { llmText, ui };
    }

    case 'summarize_transactions': {
      const f = input as ToolFilters & { group_by: string };
      const { where, params } = buildSql(f);
      const groupExprs: Record<string, string> = {
        entity: 'COALESCE(confirmed_entity, entity_tag)',
        category: 'COALESCE(confirmed_category, category)',
        account: 'account_id',
        month: "substr(posting_date, 1, 7)",
        income_source: 'income_source',
        zelle_person: 'zelle_person',
        audit_status: 'audit_status',
      };
      const expr = groupExprs[f.group_by];
      if (!expr) throw new Error(`unknown group_by: ${f.group_by}`);
      const db = getDb();
      const sql = `
        SELECT ${expr} AS k, SUM(amount) AS total, COUNT(*) AS count
        FROM transactions
        ${where}
        ${where ? 'AND' : 'WHERE'} ${expr} IS NOT NULL
        GROUP BY k
        ORDER BY ABS(total) DESC
        LIMIT 50
      `;
      const rows = db.prepare(sql).all(params) as { k: string; total: number; count: number }[];
      const groups = rows.map((r) => ({ key: String(r.k), total: r.total, count: r.count }));
      const llmText = JSON.stringify({ group_by: f.group_by, groups });
      return {
        llmText,
        ui: { kind: 'summary', groups, groupBy: f.group_by },
      };
    }

    case 'download_csv': {
      const f = input as ToolFilters & { filename?: string };
      const internalDefault = f.hide_internal !== false;
      let rows = listTransactions({
        accountId: f.account_id,
        entityTag: f.entity,
        category: f.category,
        auditStatus: f.audit_status,
        search: f.search,
        hideInternal: internalDefault,
        minAmount: f.min_amount,
        maxAmount: f.max_amount,
        dateFrom: f.date_from,
        dateTo: f.date_to,
        flaggedOnly: f.flagged_only,
        limit: 5000,
      });
      if (f.zelle_only) rows = rows.filter((r) => r.zellePerson);
      if (f.wires_only) {
        rows = rows.filter((r) =>
          ['EXPENSE_WIRE_INTL', 'EXPENSE_WIRE_DOMESTIC', 'EXPENSE_REMITTANCE', 'INCOME_WIRE'].includes(r.category)
        );
      }
      if (f.income_source) rows = rows.filter((r) => r.incomeSource === f.income_source);
      if (f.zelle_person) {
        const needle = f.zelle_person.toLowerCase();
        rows = rows.filter((r) => (r.zellePerson || '').toLowerCase().includes(needle));
      }

      const aoa: (string | number)[][] = [
        ['Date', 'Account', 'Merchant', 'Description', 'Amount', 'Category', 'Entity', 'Zelle Recipient', 'Status', 'Flag Score', 'Business Purpose'],
        ...rows.map((r) => [
          r.postingDate,
          r.accountId,
          r.merchantName,
          r.description,
          r.amount,
          r.category,
          r.confirmedEntity || r.entityTag,
          r.zellePerson || '',
          r.auditStatus,
          r.auditScore,
          r.businessPurpose || '',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const csvId = crypto.randomUUID();
      const baseName = f.filename || makeFilename(f);
      const filename = baseName.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80) + '.csv';
      csvStore.set(csvId, { csv, filename, createdAt: Date.now() });
      pruneCsv();
      return {
        llmText: JSON.stringify({
          ok: true,
          row_count: rows.length,
          filename,
          total_amount: rows.reduce((s, r) => s + r.amount, 0),
        }),
        ui: {
          kind: 'download',
          csvId,
          filename,
          rowCount: rows.length,
          sizeBytes: Buffer.byteLength(csv, 'utf8'),
        },
      };
    }

    case 'navigate_to': {
      const { page, ...rest } = input as { page: string } & Record<string, any>;
      const url = buildPageUrl(page, rest);
      const label = `Open ${page.charAt(0).toUpperCase() + page.slice(1)}`;
      return {
        llmText: JSON.stringify({ ok: true, url, label }),
        ui: { kind: 'navigate', url, label },
      };
    }
  }
  throw new Error(`unknown tool: ${name}`);
}

function makeFilename(f: ToolFilters): string {
  const parts: string[] = ['amari'];
  if (f.zelle_only || f.zelle_person) parts.push('zelle');
  if (f.wires_only) parts.push('wires');
  if (f.account_id) parts.push(`acct_${f.account_id}`);
  if (f.entity) parts.push(f.entity.toLowerCase());
  if (f.income_source) parts.push(f.income_source.toLowerCase());
  if (f.date_from) parts.push(`from_${f.date_from}`);
  if (f.date_to) parts.push(`to_${f.date_to}`);
  if (parts.length === 1) parts.push('transactions');
  return parts.join('_');
}
