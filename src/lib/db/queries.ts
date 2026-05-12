import 'server-only';
import crypto from 'crypto';
import { getDb } from './index';
import type {
  Transaction,
  ParsedTransaction,
  AuditStatus,
  EntityType,
  CategoryType,
} from '@/types';

function rowToTransaction(r: any): Transaction {
  return {
    id: r.id,
    accountId: r.account_id,
    postingDate: r.posting_date,
    description: r.description,
    amount: r.amount,
    type: r.type,
    balance: r.balance,
    merchantName: r.merchant_name,
    category: r.category,
    entityTag: r.entity_tag,
    isInternal: !!r.is_internal,
    internalLinkedId: r.internal_linked_id,
    incomeSource: r.income_source,
    confirmedEntity: r.confirmed_entity,
    confirmedCategory: r.confirmed_category,
    businessPurpose: r.business_purpose,
    receiptRef: r.receipt_ref,
    auditStatus: r.audit_status,
    auditFlags: JSON.parse(r.audit_flags || '[]'),
    auditScore: r.audit_score,
    notes: r.notes,
    zellePerson: r.zelle_person,
    zelleType: r.zelle_type,
    importedAt: r.imported_at,
    updatedAt: r.updated_at,
    importBatchId: r.import_batch_id,
  };
}

function hashTx(accountId: string, date: string, amount: number, description: string): string {
  return crypto
    .createHash('sha256')
    .update(`${accountId}|${date}|${amount.toFixed(2)}|${description.trim()}`)
    .digest('hex')
    .slice(0, 32);
}

export interface SaveBatchResult {
  batchId: string;
  inserted: number;
  duplicates: number;
}

export function saveImportBatch(
  filename: string,
  accountId: string,
  rows: ParsedTransaction[],
): SaveBatchResult {
  const db = getDb();
  const batchId = crypto.randomUUID();
  const now = Date.now();
  const dates = rows.map((r) => r.postingDate).sort();
  const dateFrom = dates[0] || null;
  const dateTo = dates[dates.length - 1] || null;

  const insertBatch = db.prepare(
    `INSERT INTO import_batches (id, file_name, account_id, imported_at, row_count, date_range_from, date_range_to)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertTx = db.prepare(
    `INSERT OR IGNORE INTO transactions (
      id, account_id, posting_date, description, amount, type, balance,
      merchant_name, category, entity_tag, is_internal, internal_linked_id,
      income_source, confirmed_entity, confirmed_category, business_purpose,
      receipt_ref, audit_status, audit_flags, audit_score, notes,
      zelle_person, zelle_type, imported_at, updated_at, import_batch_id, hash
    ) VALUES (
      @id, @account_id, @posting_date, @description, @amount, @type, @balance,
      @merchant_name, @category, @entity_tag, @is_internal, NULL,
      @income_source, NULL, NULL, NULL,
      NULL, 'UNREVIEWED', @audit_flags, @audit_score, NULL,
      @zelle_person, @zelle_type, @imported_at, @updated_at, @import_batch_id, @hash
    )`
  );

  let inserted = 0;
  let duplicates = 0;
  const txWrite = db.transaction(() => {
    insertBatch.run(batchId, filename, accountId, now, rows.length, dateFrom, dateTo);
    for (const r of rows) {
      const hash = hashTx(r.accountId, r.postingDate, r.amount, r.description);
      const id = crypto.randomUUID();
      const res = insertTx.run({
        id,
        account_id: r.accountId,
        posting_date: r.postingDate,
        description: r.description,
        amount: r.amount,
        type: r.type,
        balance: r.balance,
        merchant_name: r.merchantName,
        category: r.category,
        entity_tag: r.entityTag,
        is_internal: r.isInternal ? 1 : 0,
        income_source: r.incomeSource,
        audit_flags: JSON.stringify(r.auditFlags || []),
        audit_score: r.auditScore || 0,
        zelle_person: r.zellePerson,
        zelle_type: r.zelleType,
        imported_at: now,
        updated_at: now,
        import_batch_id: batchId,
        hash,
      });
      if (res.changes > 0) inserted += 1;
      else duplicates += 1;
    }
  });
  txWrite();
  return { batchId, inserted, duplicates };
}

export interface ListFilters {
  accountId?: string;
  entityTag?: EntityType;
  category?: CategoryType;
  auditStatus?: AuditStatus;
  search?: string;
  hideInternal?: boolean;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  flaggedOnly?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'posting_date' | 'audit_score' | 'amount';
  orderDir?: 'ASC' | 'DESC';
}

export function listTransactions(filters: ListFilters = {}): Transaction[] {
  const db = getDb();
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.accountId) { where.push('account_id = @accountId'); params.accountId = filters.accountId; }
  if (filters.entityTag) { where.push('COALESCE(confirmed_entity, entity_tag) = @entityTag'); params.entityTag = filters.entityTag; }
  if (filters.category) { where.push('COALESCE(confirmed_category, category) = @category'); params.category = filters.category; }
  if (filters.auditStatus) { where.push('audit_status = @auditStatus'); params.auditStatus = filters.auditStatus; }
  if (filters.search) { where.push('(description LIKE @search OR merchant_name LIKE @search OR zelle_person LIKE @search)'); params.search = `%${filters.search}%`; }
  if (filters.hideInternal) { where.push('is_internal = 0'); }
  if (filters.minAmount !== undefined) { where.push('amount >= @minAmount'); params.minAmount = filters.minAmount; }
  if (filters.maxAmount !== undefined) { where.push('amount <= @maxAmount'); params.maxAmount = filters.maxAmount; }
  if (filters.dateFrom) { where.push('posting_date >= @dateFrom'); params.dateFrom = filters.dateFrom; }
  if (filters.dateTo) { where.push('posting_date <= @dateTo'); params.dateTo = filters.dateTo; }
  if (filters.flaggedOnly) { where.push('audit_score > 0 AND audit_status = \'UNREVIEWED\''); }

  const orderBy = filters.orderBy || 'posting_date';
  const orderDir = filters.orderDir || 'DESC';
  const limit = Math.min(filters.limit ?? 500, 5000);
  const offset = filters.offset ?? 0;

  const sql = `
    SELECT * FROM transactions
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${orderBy} ${orderDir}, id ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const rows = db.prepare(sql).all(params) as any[];
  return rows.map(rowToTransaction);
}

export function getTransaction(id: string): Transaction | null {
  const db = getDb();
  const r = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
  return r ? rowToTransaction(r) : null;
}

export function countTransactions(filters: ListFilters = {}): number {
  const db = getDb();
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filters.hideInternal) where.push('is_internal = 0');
  if (filters.flaggedOnly) where.push('audit_score > 0 AND audit_status = \'UNREVIEWED\'');
  if (filters.auditStatus) { where.push('audit_status = @auditStatus'); params.auditStatus = filters.auditStatus; }
  const sql = `SELECT COUNT(*) as c FROM transactions ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  return (db.prepare(sql).get(params) as { c: number }).c;
}

export interface UpdateTxPatch {
  confirmedEntity?: EntityType | null;
  confirmedCategory?: CategoryType | null;
  businessPurpose?: string | null;
  receiptRef?: string | null;
  auditStatus?: AuditStatus;
  notes?: string | null;
  zelleType?: string | null;
}

export function updateTransaction(id: string, patch: UpdateTxPatch): void {
  const db = getDb();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id, updated_at: Date.now() };
  if (patch.confirmedEntity !== undefined) { fields.push('confirmed_entity = @confirmed_entity'); params.confirmed_entity = patch.confirmedEntity; }
  if (patch.confirmedCategory !== undefined) { fields.push('confirmed_category = @confirmed_category'); params.confirmed_category = patch.confirmedCategory; }
  if (patch.businessPurpose !== undefined) { fields.push('business_purpose = @business_purpose'); params.business_purpose = patch.businessPurpose; }
  if (patch.receiptRef !== undefined) { fields.push('receipt_ref = @receipt_ref'); params.receipt_ref = patch.receiptRef; }
  if (patch.auditStatus !== undefined) { fields.push('audit_status = @audit_status'); params.audit_status = patch.auditStatus; }
  if (patch.notes !== undefined) { fields.push('notes = @notes'); params.notes = patch.notes; }
  if (patch.zelleType !== undefined) { fields.push('zelle_type = @zelle_type'); params.zelle_type = patch.zelleType; }
  if (fields.length === 0) return;
  fields.push('updated_at = @updated_at');
  db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

// ===== Account / aggregate queries for dashboard =====

export interface AccountSummary {
  accountId: string;
  income: number;
  expenses: number;
  net: number;
  count: number;
  internalCount: number;
  topIncomeSource: string | null;
}

export function summarizeAccounts(): AccountSummary[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      account_id,
      SUM(CASE WHEN amount > 0 AND is_internal = 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_internal = 0 THEN ABS(amount) ELSE 0 END) as expenses,
      SUM(CASE WHEN is_internal = 0 THEN amount ELSE 0 END) as net,
      SUM(CASE WHEN is_internal = 0 THEN 1 ELSE 0 END) as count,
      SUM(CASE WHEN is_internal = 1 THEN 1 ELSE 0 END) as internalCount
    FROM transactions
    GROUP BY account_id
  `).all() as any[];

  const incomeBySrc = db.prepare(`
    SELECT account_id, income_source, SUM(amount) as total
    FROM transactions
    WHERE income_source IS NOT NULL AND is_internal = 0 AND amount > 0
    GROUP BY account_id, income_source
  `).all() as any[];

  const topByAcct = new Map<string, { source: string; total: number }>();
  for (const r of incomeBySrc) {
    const existing = topByAcct.get(r.account_id);
    if (!existing || r.total > existing.total) {
      topByAcct.set(r.account_id, { source: r.income_source, total: r.total });
    }
  }

  return rows.map((r) => ({
    accountId: r.account_id,
    income: r.income || 0,
    expenses: r.expenses || 0,
    net: r.net || 0,
    count: r.count || 0,
    internalCount: r.internalCount || 0,
    topIncomeSource: topByAcct.get(r.account_id)?.source || null,
  }));
}

export interface PortfolioSummary {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  totalCount: number;
  reviewedCount: number;
  openFlagCount: number;
  criticalFlagCount: number;
  highFlagCount: number;
  mediumFlagCount: number;
}

export function portfolioSummary(): PortfolioSummary {
  const db = getDb();
  const agg = db.prepare(`
    SELECT
      SUM(CASE WHEN amount > 0 AND is_internal = 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_internal = 0 THEN ABS(amount) ELSE 0 END) as expenses,
      SUM(CASE WHEN is_internal = 0 THEN 1 ELSE 0 END) as total,
      SUM(CASE WHEN audit_status IN ('CONFIRMED','TAGGED','PERSONAL_NO_DEDUCT','NEEDS_RECEIPT') THEN 1 ELSE 0 END) as reviewed
    FROM transactions
  `).get() as any;

  const flags = db.prepare(`
    SELECT
      SUM(CASE WHEN audit_status = 'UNREVIEWED' AND audit_score >= 80 THEN 1 ELSE 0 END) as crit,
      SUM(CASE WHEN audit_status = 'UNREVIEWED' AND audit_score >= 60 AND audit_score < 80 THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN audit_status = 'UNREVIEWED' AND audit_score >= 35 AND audit_score < 60 THEN 1 ELSE 0 END) as med
    FROM transactions
  `).get() as any;

  const c = flags.crit || 0;
  const h = flags.high || 0;
  const m = flags.med || 0;
  return {
    totalIncome: agg.income || 0,
    totalExpenses: agg.expenses || 0,
    net: (agg.income || 0) - (agg.expenses || 0),
    totalCount: agg.total || 0,
    reviewedCount: agg.reviewed || 0,
    openFlagCount: c + h + m,
    criticalFlagCount: c,
    highFlagCount: h,
    mediumFlagCount: m,
  };
}

export interface IncomeSourceBreakdown {
  source: string;
  total: number;
  count: number;
}

export function incomeBySources(): IncomeSourceBreakdown[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT income_source as source, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE income_source IS NOT NULL AND amount > 0 AND is_internal = 0
    GROUP BY income_source
    ORDER BY total DESC
  `).all() as any[];
  return rows.map((r) => ({ source: r.source, total: r.total, count: r.count }));
}

export interface EntityPL {
  entity: EntityType;
  income: number;
  expenses: number;
  net: number;
  topExpenseCategories: { category: string; amount: number }[];
}

export function entityPLs(): EntityPL[] {
  const db = getDb();
  const agg = db.prepare(`
    SELECT
      COALESCE(confirmed_entity, entity_tag) as entity,
      SUM(CASE WHEN amount > 0 AND is_internal = 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_internal = 0 THEN ABS(amount) ELSE 0 END) as expenses
    FROM transactions
    GROUP BY entity
  `).all() as any[];

  const expensesByCat = db.prepare(`
    SELECT
      COALESCE(confirmed_entity, entity_tag) as entity,
      COALESCE(confirmed_category, category) as category,
      SUM(ABS(amount)) as total
    FROM transactions
    WHERE amount < 0 AND is_internal = 0
    GROUP BY entity, category
  `).all() as any[];

  const byEntityCat = new Map<string, { category: string; amount: number }[]>();
  for (const r of expensesByCat) {
    const list = byEntityCat.get(r.entity) || [];
    list.push({ category: r.category, amount: r.total });
    byEntityCat.set(r.entity, list);
  }

  return agg.map((r) => ({
    entity: r.entity as EntityType,
    income: r.income || 0,
    expenses: r.expenses || 0,
    net: (r.income || 0) - (r.expenses || 0),
    topExpenseCategories: (byEntityCat.get(r.entity) || [])
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4),
  }));
}

export interface ZelleAggregate {
  person: string;
  totalPaid: number;
  count: number;
  firstDate: string;
  lastDate: string;
  accounts: string[];
  zelleType: string | null;
  needs1099: boolean;
}

export function zelleByPerson(): ZelleAggregate[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      zelle_person as person,
      SUM(ABS(amount)) as totalPaid,
      COUNT(*) as count,
      MIN(posting_date) as firstDate,
      MAX(posting_date) as lastDate,
      GROUP_CONCAT(DISTINCT account_id) as accounts,
      MAX(zelle_type) as zelleType
    FROM transactions
    WHERE zelle_person IS NOT NULL AND amount < 0 AND is_internal = 0
    GROUP BY zelle_person
    ORDER BY totalPaid DESC
  `).all() as any[];
  return rows.map((r) => ({
    person: r.person,
    totalPaid: r.totalPaid,
    count: r.count,
    firstDate: r.firstDate,
    lastDate: r.lastDate,
    accounts: (r.accounts || '').split(','),
    zelleType: r.zelleType,
    needs1099: r.totalPaid >= 600 && (r.zelleType === 'CONTRACTOR' || r.zelleType === 'COMPENSATION'),
  }));
}

export interface ImportBatchRow {
  id: string;
  fileName: string;
  accountId: string;
  importedAt: number;
  rowCount: number;
  dateRangeFrom: string | null;
  dateRangeTo: string | null;
}

export function listImports(): ImportBatchRow[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, file_name as fileName, account_id as accountId, imported_at as importedAt,
      row_count as rowCount, date_range_from as dateRangeFrom, date_range_to as dateRangeTo
    FROM import_batches
    ORDER BY imported_at DESC
  `).all() as any[];
  return rows;
}
