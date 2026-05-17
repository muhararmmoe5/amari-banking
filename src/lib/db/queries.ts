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
    individual: r.individual ?? null,
    subCategory1: r.sub_category_1 ?? null,
    subCategory2: r.sub_category_2 ?? null,
    sourceOfMoney: r.source_of_money ?? null,
    needToGetFrom: r.need_to_get_from ?? null,
    cpaReviewed: !!r.cpa_reviewed,
    taggedDate: r.tagged_date ?? null,
    sourcePersonId: r.source_person_id ?? null,
    transactionDate: r.transaction_date ?? null,
    sourceBusiness: r.source_business ?? null,
    sourceAccountId: r.source_account_id ?? null,
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
      id, account_id, posting_date, transaction_date, description, amount, type, balance,
      merchant_name, category, entity_tag, is_internal, internal_linked_id,
      income_source, confirmed_entity, confirmed_category, business_purpose,
      receipt_ref, audit_status, audit_flags, audit_score, notes,
      zelle_person, zelle_type, imported_at, updated_at, import_batch_id, hash
    ) VALUES (
      @id, @account_id, @posting_date, @transaction_date, @description, @amount, @type, @balance,
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
        transaction_date: r.transactionDate,
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
  bookDateFrom?: string;
  bookDateTo?: string;
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
  if (filters.bookDateFrom) { where.push('tagged_date >= @bookDateFrom'); params.bookDateFrom = filters.bookDateFrom; }
  if (filters.bookDateTo) { where.push('tagged_date <= @bookDateTo'); params.bookDateTo = filters.bookDateTo; }
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
  individual?: string | null;
  subCategory1?: string | null;
  subCategory2?: string | null;
  sourceOfMoney?: string | null;
  needToGetFrom?: string | null;
  cpaReviewed?: boolean;
  taggedDate?: string | null;
  sourcePersonId?: string | null;
  sourceBusiness?: string | null;
  sourceAccountId?: string | null;
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
  if (patch.individual !== undefined) { fields.push('individual = @individual'); params.individual = patch.individual; }
  if (patch.subCategory1 !== undefined) { fields.push('sub_category_1 = @sub_category_1'); params.sub_category_1 = patch.subCategory1; }
  if (patch.subCategory2 !== undefined) { fields.push('sub_category_2 = @sub_category_2'); params.sub_category_2 = patch.subCategory2; }
  if (patch.sourceOfMoney !== undefined) { fields.push('source_of_money = @source_of_money'); params.source_of_money = patch.sourceOfMoney; }
  if (patch.needToGetFrom !== undefined) { fields.push('need_to_get_from = @need_to_get_from'); params.need_to_get_from = patch.needToGetFrom; }
  if (patch.cpaReviewed !== undefined) { fields.push('cpa_reviewed = @cpa_reviewed'); params.cpa_reviewed = patch.cpaReviewed ? 1 : 0; }
  if (patch.taggedDate !== undefined) { fields.push('tagged_date = @tagged_date'); params.tagged_date = patch.taggedDate; }
  if (patch.sourcePersonId !== undefined) { fields.push('source_person_id = @source_person_id'); params.source_person_id = patch.sourcePersonId; }
  if (patch.sourceBusiness !== undefined) { fields.push('source_business = @source_business'); params.source_business = patch.sourceBusiness; }
  if (patch.sourceAccountId !== undefined) { fields.push('source_account_id = @source_account_id'); params.source_account_id = patch.sourceAccountId; }
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

export function summarizeAccounts(dateFrom?: string, dateTo?: string): AccountSummary[] {
  const db = getDb();
  const where: string[] = [];
  const p: Record<string, unknown> = {};
  if (dateFrom) { where.push('posting_date >= @dateFrom'); p.dateFrom = dateFrom; }
  if (dateTo) { where.push('posting_date <= @dateTo'); p.dateTo = dateTo; }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT
      account_id,
      SUM(CASE WHEN amount > 0 AND is_internal = 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_internal = 0 THEN ABS(amount) ELSE 0 END) as expenses,
      SUM(CASE WHEN is_internal = 0 THEN amount ELSE 0 END) as net,
      SUM(CASE WHEN is_internal = 0 THEN 1 ELSE 0 END) as count,
      SUM(CASE WHEN is_internal = 1 THEN 1 ELSE 0 END) as internalCount
    FROM transactions ${w}
    GROUP BY account_id
  `).all(p) as any[];

  const incomeBySrc = db.prepare(`
    SELECT account_id, income_source, SUM(amount) as total
    FROM transactions
    WHERE income_source IS NOT NULL AND is_internal = 0 AND amount > 0
      ${where.length ? 'AND ' + where.join(' AND ') : ''}
    GROUP BY account_id, income_source
  `).all(p) as any[];

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

export function portfolioSummary(dateFrom?: string, dateTo?: string): PortfolioSummary {
  const db = getDb();
  const where: string[] = [];
  const p: Record<string, unknown> = {};
  if (dateFrom) { where.push('posting_date >= @dateFrom'); p.dateFrom = dateFrom; }
  if (dateTo) { where.push('posting_date <= @dateTo'); p.dateTo = dateTo; }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const agg = db.prepare(`
    SELECT
      SUM(CASE WHEN amount > 0 AND is_internal = 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_internal = 0 THEN ABS(amount) ELSE 0 END) as expenses,
      SUM(CASE WHEN is_internal = 0 THEN 1 ELSE 0 END) as total,
      SUM(CASE WHEN audit_status IN ('CONFIRMED','TAGGED','PERSONAL_NO_DEDUCT','NEEDS_RECEIPT') THEN 1 ELSE 0 END) as reviewed
    FROM transactions ${w}
  `).get(p) as any;

  const flags = db.prepare(`
    SELECT
      SUM(CASE WHEN audit_status = 'UNREVIEWED' AND audit_score >= 80 THEN 1 ELSE 0 END) as crit,
      SUM(CASE WHEN audit_status = 'UNREVIEWED' AND audit_score >= 60 AND audit_score < 80 THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN audit_status = 'UNREVIEWED' AND audit_score >= 35 AND audit_score < 60 THEN 1 ELSE 0 END) as med
    FROM transactions ${w}
  `).get(p) as any;

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

export function incomeBySources(dateFrom?: string, dateTo?: string): IncomeSourceBreakdown[] {
  const db = getDb();
  const where: string[] = ['income_source IS NOT NULL', 'amount > 0', 'is_internal = 0'];
  const p: Record<string, unknown> = {};
  if (dateFrom) { where.push('posting_date >= @dateFrom'); p.dateFrom = dateFrom; }
  if (dateTo) { where.push('posting_date <= @dateTo'); p.dateTo = dateTo; }
  const rows = db.prepare(`
    SELECT income_source as source, SUM(amount) as total, COUNT(*) as count
    FROM transactions
    WHERE ${where.join(' AND ')}
    GROUP BY income_source
    ORDER BY total DESC
  `).all(p) as any[];
  return rows.map((r) => ({ source: r.source, total: r.total, count: r.count }));
}

export interface AuditRings {
  wires: { total: number; reviewed: number };
  zelle: { total: number; reviewed: number };
  personal: { total: number; reviewed: number };
}

export function auditRings(dateFrom?: string, dateTo?: string): AuditRings {
  const db = getDb();
  const where: string[] = [];
  const p: Record<string, unknown> = {};
  if (dateFrom) { where.push('posting_date >= @dateFrom'); p.dateFrom = dateFrom; }
  if (dateTo) { where.push('posting_date <= @dateTo'); p.dateTo = dateTo; }
  const w = where.length ? 'AND ' + where.join(' AND ') : '';
  const reviewedExpr = `audit_status IN ('CONFIRMED','TAGGED','PERSONAL_NO_DEDUCT','NEEDS_RECEIPT')`;

  const wires = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ${reviewedExpr} THEN 1 ELSE 0 END) as reviewed
    FROM transactions
    WHERE category IN ('EXPENSE_WIRE_INTL','EXPENSE_WIRE_DOMESTIC','EXPENSE_REMITTANCE','INCOME_WIRE') ${w}
  `).get(p) as any;
  const zelle = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ${reviewedExpr} THEN 1 ELSE 0 END) as reviewed
    FROM transactions
    WHERE zelle_person IS NOT NULL ${w}
  `).get(p) as any;
  const personal = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ${reviewedExpr} THEN 1 ELSE 0 END) as reviewed
    FROM transactions
    WHERE account_id = '7056' AND is_internal = 0 ${w}
  `).get(p) as any;

  return {
    wires: { total: wires.total || 0, reviewed: wires.reviewed || 0 },
    zelle: { total: zelle.total || 0, reviewed: zelle.reviewed || 0 },
    personal: { total: personal.total || 0, reviewed: personal.reviewed || 0 },
  };
}

export interface EntityPL {
  entity: EntityType;
  income: number;
  expenses: number;
  net: number;
  topExpenseCategories: { category: string; amount: number }[];
}

export function entityPLs(dateFrom?: string, dateTo?: string): EntityPL[] {
  const db = getDb();
  const where: string[] = [];
  const p: Record<string, unknown> = {};
  if (dateFrom) { where.push('posting_date >= @dateFrom'); p.dateFrom = dateFrom; }
  if (dateTo) { where.push('posting_date <= @dateTo'); p.dateTo = dateTo; }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const agg = db.prepare(`
    SELECT
      COALESCE(confirmed_entity, entity_tag) as entity,
      SUM(CASE WHEN amount > 0 AND is_internal = 0 THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN amount < 0 AND is_internal = 0 THEN ABS(amount) ELSE 0 END) as expenses
    FROM transactions ${w}
    GROUP BY entity
  `).all(p) as any[];

  const expensesByCat = db.prepare(`
    SELECT
      COALESCE(confirmed_entity, entity_tag) as entity,
      COALESCE(confirmed_category, category) as category,
      SUM(ABS(amount)) as total
    FROM transactions
    WHERE amount < 0 AND is_internal = 0
      ${where.length ? 'AND ' + where.join(' AND ') : ''}
    GROUP BY entity, category
  `).all(p) as any[];

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

export interface IncomeTimePoint {
  month: string;
  [source: string]: number | string;
}

export function incomeByMonthAndSource(): { points: IncomeTimePoint[]; sources: string[] } {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      substr(posting_date, 1, 7) as month,
      income_source as source,
      SUM(amount) as total
    FROM transactions
    WHERE income_source IS NOT NULL AND amount > 0 AND is_internal = 0
    GROUP BY month, source
    ORDER BY month ASC
  `).all() as { month: string; source: string; total: number }[];

  const sourceSet = new Set<string>();
  const byMonth = new Map<string, Record<string, number>>();
  for (const r of rows) {
    sourceSet.add(r.source);
    const m = byMonth.get(r.month) || {};
    m[r.source] = (m[r.source] || 0) + r.total;
    byMonth.set(r.month, m);
  }
  const sources = Array.from(sourceSet);
  const points: IncomeTimePoint[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => {
      const point: IncomeTimePoint = { month };
      for (const s of sources) point[s] = vals[s] || 0;
      return point;
    });
  return { points, sources };
}

// ===== Balances & money-flow trace =====

export interface CurrentBalance {
  accountId: string;
  balance: number;
  asOfDate: string;
}

export function getCurrentBalances(): Map<string, CurrentBalance> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT account_id, balance, posting_date FROM (
      SELECT account_id, balance, posting_date,
        ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY posting_date DESC, id DESC) as rn
      FROM transactions
      WHERE balance IS NOT NULL
    ) WHERE rn = 1
  `).all() as { account_id: string; balance: number; posting_date: string }[];
  const m = new Map<string, CurrentBalance>();
  for (const r of rows) m.set(r.account_id, { accountId: r.account_id, balance: r.balance, asOfDate: r.posting_date });
  return m;
}

export interface InflowEvent {
  id: string;
  accountId: string;
  postingDate: string;
  description: string;
  merchantName: string | null;
  amount: number;
  incomeSource: string | null;
  entity: string;
}

export function listLargeInflows(opts: {
  minAmount?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  accountId?: string;
  incomeSource?: string;
} = {}): InflowEvent[] {
  const db = getDb();
  const minAmount = opts.minAmount ?? 500;
  const where: string[] = ['amount > 0', 'is_internal = 0', 'amount >= @minAmount'];
  const p: Record<string, unknown> = { minAmount };
  if (opts.dateFrom) { where.push('posting_date >= @dateFrom'); p.dateFrom = opts.dateFrom; }
  if (opts.dateTo) { where.push('posting_date <= @dateTo'); p.dateTo = opts.dateTo; }
  if (opts.accountId) { where.push('account_id = @accountId'); p.accountId = opts.accountId; }
  if (opts.incomeSource) { where.push('income_source = @incomeSource'); p.incomeSource = opts.incomeSource; }
  const rows = db.prepare(`
    SELECT id, account_id, posting_date, description, merchant_name, amount, income_source,
      COALESCE(confirmed_entity, entity_tag) as entity
    FROM transactions
    WHERE ${where.join(' AND ')}
    ORDER BY amount DESC, posting_date DESC
    LIMIT @limit
  `).all({ ...p, limit: Math.min(200, opts.limit ?? 25) }) as any[];
  return rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    postingDate: r.posting_date,
    description: r.description,
    merchantName: r.merchant_name,
    amount: r.amount,
    incomeSource: r.income_source,
    entity: r.entity,
  }));
}

export interface DayActivityRow {
  id: string;
  postingDate: string;
  description: string;
  merchantName: string | null;
  amount: number;
  balanceAfter: number | null;
  isInternal: boolean;
  counterpartyAccountId: string | null;
  category: string;
}

export function getAccountDayActivity(accountId: string, date: string): DayActivityRow[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.id, t.posting_date, t.description, t.merchant_name, t.amount, t.balance,
      t.is_internal, t.internal_linked_id, t.category,
      linked.account_id as counterparty_account_id
    FROM transactions t
    LEFT JOIN transactions linked ON linked.id = t.internal_linked_id
    WHERE t.account_id = ? AND t.posting_date = ?
    ORDER BY t.id ASC
  `).all(accountId, date) as any[];
  return rows.map((r) => ({
    id: r.id,
    postingDate: r.posting_date,
    description: r.description,
    merchantName: r.merchant_name,
    amount: r.amount,
    balanceAfter: r.balance,
    isInternal: !!r.is_internal,
    counterpartyAccountId: r.counterparty_account_id,
    category: r.category,
  }));
}

export interface DashboardAlerts {
  criticalWires: number;
  unclassifiedZelle: number;
  applePayPayPal: number;
  near1099: number;
  personalOutflows: number;
  unknownIncome: number;
}

export function dashboardAlerts(dateFrom?: string, dateTo?: string): DashboardAlerts {
  const db = getDb();
  const where: string[] = ["audit_status = 'UNREVIEWED'"];
  const p: Record<string, unknown> = {};
  if (dateFrom) { where.push('posting_date >= @dateFrom'); p.dateFrom = dateFrom; }
  if (dateTo) { where.push('posting_date <= @dateTo'); p.dateTo = dateTo; }
  const baseWhere = where.join(' AND ');

  const criticalWires = (db.prepare(
    `SELECT COUNT(*) c FROM transactions WHERE ${baseWhere}
     AND category IN ('EXPENSE_WIRE_INTL','EXPENSE_WIRE_DOMESTIC')`
  ).get(p) as { c: number }).c;

  const unclassifiedZelle = (db.prepare(
    `SELECT COUNT(*) c FROM transactions WHERE ${baseWhere}
     AND zelle_person IS NOT NULL AND entity_tag = 'UNKNOWN'`
  ).get(p) as { c: number }).c;

  const applePayPayPal = (db.prepare(
    `SELECT COUNT(*) c FROM transactions WHERE ${baseWhere}
     AND category IN ('EXPENSE_APPLE_CASH','EXPENSE_PAYPAL')`
  ).get(p) as { c: number }).c;

  const near1099 = (db.prepare(
    `SELECT COUNT(*) c FROM (
       SELECT zelle_person, SUM(ABS(amount)) total FROM transactions
       WHERE zelle_person IS NOT NULL AND amount < 0 AND is_internal = 0
       ${dateFrom ? 'AND posting_date >= @dateFrom' : ''}
       ${dateTo ? 'AND posting_date <= @dateTo' : ''}
       GROUP BY zelle_person HAVING total >= 600
     )`
  ).get(p) as { c: number }).c;

  const personalOutflows = (db.prepare(
    `SELECT COUNT(*) c FROM transactions WHERE ${baseWhere}
     AND account_id = '7056' AND amount < 0 AND ABS(amount) > 200 AND is_internal = 0`
  ).get(p) as { c: number }).c;

  const unknownIncome = (db.prepare(
    `SELECT COUNT(*) c FROM transactions WHERE ${baseWhere}
     AND amount > 0 AND is_internal = 0 AND (income_source = 'WIRE_UNKNOWN' OR income_source = 'OTHER' OR income_source IS NULL)`
  ).get(p) as { c: number }).c;

  return { criticalWires, unclassifiedZelle, applePayPayPal, near1099, personalOutflows, unknownIncome };
}

export function flagCountsByEntity(): Record<string, number> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT COALESCE(confirmed_entity, entity_tag) as entity, COUNT(*) as count
    FROM transactions
    WHERE audit_status = 'UNREVIEWED' AND audit_score > 0
    GROUP BY entity
  `).all() as { entity: string; count: number }[];
  const out: Record<string, number> = {};
  for (const r of rows) out[r.entity] = r.count;
  return out;
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
