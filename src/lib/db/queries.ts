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
    budgetId: r.budget_id ?? null,
    fundingCommitmentId: r.funding_commitment_id ?? null,
    isSalary: !!r.is_salary,
    salaryEntity: r.salary_entity ?? null,
    salaryPersonId: r.salary_person_id ?? null,
    passthroughEntity: r.passthrough_entity ?? null,
    passthroughPurpose: r.passthrough_purpose ?? null,
    passthroughPersonId: r.passthrough_person_id ?? null,
    passthroughNotes: r.passthrough_notes ?? null,
    fundedByTransactionId: r.funded_by_transaction_id ?? null,
    bookingDateMode: r.booking_date_mode ?? null,
    isRecurring: !!r.is_recurring,
    recurringFrequency: r.recurring_frequency ?? null,
    recurringNextDate: r.recurring_next_date ?? null,
    recurringLabel: r.recurring_label ?? null,
    recurringAlertDays: r.recurring_alert_days ?? null,
    recurringAlertDays2: r.recurring_alert_days_2 ?? null,
    recurringExpectedCents: r.recurring_expected_cents ?? null,
    reviewState: r.review_state ?? null,
    reviewerName: r.reviewer_name ?? null,
    reviewedAt: r.reviewed_at ?? null,
    needsEscalation: !!r.needs_escalation,
    escalationTo: r.escalation_to ?? null,
    escalationNotes: r.escalation_notes ?? null,
    salaryId: r.salary_id ?? null,
    businessDepartment: r.business_department ?? null,
    businessCat1Key: r.business_cat1_key ?? null,
    personalCat1Key: r.personal_cat1_key ?? null,
    taxTreatment: r.tax_treatment ?? null,
    taxForm: r.tax_form ?? null,
    autoDetectRule: !!r.auto_detect_rule,
    cpaReviewedAt: r.cpa_reviewed_at ?? null,
    cpaReviewerName: r.cpa_reviewer_name ?? null,
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

// Re-export the Plaid-ready fingerprint primitive so callers don't reach
// into lib/db internals.
import { computeFingerprint as _computeFingerprint, normalizeMerchant as _normalizeMerchant } from './fingerprint';
export const computeFingerprint = _computeFingerprint;
export const normalizeMerchant = _normalizeMerchant;

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
      merchant_name, merchant_normalized, category, entity_tag, is_internal, internal_linked_id,
      income_source, confirmed_entity, confirmed_category, business_purpose,
      receipt_ref, audit_status, audit_flags, audit_score, notes,
      zelle_person, zelle_type, imported_at, updated_at, import_batch_id, hash,
      source, external_id, raw_data, fingerprint, pending
    ) VALUES (
      @id, @account_id, @posting_date, @transaction_date, @description, @amount, @type, @balance,
      @merchant_name, @merchant_normalized, @category, @entity_tag, @is_internal, NULL,
      @income_source, NULL, NULL, NULL,
      NULL, 'UNREVIEWED', @audit_flags, @audit_score, NULL,
      @zelle_person, @zelle_type, @imported_at, @updated_at, @import_batch_id, @hash,
      'csv', NULL, @raw_data, @fingerprint, 0
    )`
  );

  let inserted = 0;
  let duplicates = 0;
  const txWrite = db.transaction(() => {
    insertBatch.run(batchId, filename, accountId, now, rows.length, dateFrom, dateTo);
    for (const r of rows) {
      const hash = hashTx(r.accountId, r.postingDate, r.amount, r.description);
      const id = crypto.randomUUID();
      const merchantRaw = r.merchantName || r.description;
      const merchantNormalized = _normalizeMerchant(merchantRaw);
      const fingerprint = _computeFingerprint(r.amount, r.postingDate, merchantRaw);
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
        merchant_normalized: merchantNormalized,
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
        raw_data: JSON.stringify(r),
        fingerprint,
      });
      if (res.changes > 0) inserted += 1;
      else duplicates += 1;
    }
  });
  txWrite();

  // Also log to the source-aware ingestion_log table (CLAUDE.md contract).
  // import_batches is kept for backward compat with existing UI references.
  try {
    db.prepare(`
      INSERT INTO ingestion_log (id, source, identifier, started_at, completed_at,
        records_inserted, records_merged, records_duplicate, records_skipped, records_orphaned)
      VALUES (?, 'csv', ?, ?, ?, ?, 0, ?, 0, 0)
    `).run(crypto.randomUUID(), filename, now, Date.now(), inserted, duplicates);
  } catch (_e) { /* table may not exist on very old dbs */ }

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
  /** Filter by review workflow. 'PENDING_REVIEW' includes rows whose
   *  review_state is null (default state for unreviewed transactions).
   *  'ESCALATIONS' returns rows where needs_escalation = 1. */
  reviewBucket?: 'PENDING_REVIEW' | 'REVIEWED' | 'REVIEWED_APPROVED' | 'ESCALATIONS' | 'ALL';
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
  if (filters.reviewBucket && filters.reviewBucket !== 'ALL') {
    if (filters.reviewBucket === 'PENDING_REVIEW') {
      where.push("(review_state IS NULL OR review_state = 'PENDING_REVIEW')");
    } else if (filters.reviewBucket === 'REVIEWED') {
      where.push("review_state = 'REVIEWED'");
    } else if (filters.reviewBucket === 'REVIEWED_APPROVED') {
      where.push("review_state = 'REVIEWED_APPROVED'");
    } else if (filters.reviewBucket === 'ESCALATIONS') {
      where.push('needs_escalation = 1');
    }
  }

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

  // Within a single (account_id, posting_date), Chase's actual processing
  // order is not the CSV insertion order. The "balance after" column from
  // Chase IS authoritative — each row's balance equals the previous
  // chronological row's balance + this row's amount. We use that to chain
  // same-day rows into Chase's true order so "Balance after" reads sensibly.
  const ordered = chainSameDayByBalance(rows, orderDir);

  return ordered.map(rowToTransaction);
}

/** Reorder rows within each (account_id, posting_date) group so that the
 *  bank's balance column chains correctly. Falls back to insertion order
 *  when the chain can't be reconstructed (missing balance, non-monotonic). */
function chainSameDayByBalance(rows: any[], orderDir: 'ASC' | 'DESC'): any[] {
  const out: any[] = [];
  let i = 0;
  while (i < rows.length) {
    const dayKey = `${rows[i].account_id}|${rows[i].posting_date}`;
    let j = i;
    while (j < rows.length && `${rows[j].account_id}|${rows[j].posting_date}` === dayKey) j++;
    const group = rows.slice(i, j);
    if (group.length <= 1 || group.some((r) => r.balance == null)) {
      out.push(...group);
    } else {
      out.push(...chainGroup(group, orderDir));
    }
    i = j;
  }
  return out;
}

function chainGroup(group: any[], orderDir: 'ASC' | 'DESC'): any[] {
  // Same-day rows from Chase can form MULTIPLE separate chains within one day
  // (e.g. a main chain of credits/debits, plus orphan end-of-day bank fees
  // that chain to the previous day's closing balance). Approach:
  //   1. Build a map balance(of cents) -> row.
  //   2. From each row, hop forward via the "next row's prev_balance equals
  //      my balance" rule. Collect each chain.
  //   3. For DESC display, reverse each chain internally (latest tx on top).
  //   4. Sort chains by their TOP balance descending, so the chain ending at
  //      the highest balance shows first.
  const balToRow = new Map<string, any>();
  for (const r of group) {
    const key = (Math.round(r.balance * 100) / 100).toFixed(2);
    if (!balToRow.has(key)) balToRow.set(key, r);
  }
  // For each row, compute the row that comes AFTER it (whose prev_balance == my balance)
  const nextOf = new Map<string, any | null>();
  for (const r of group) {
    const myKey = (Math.round(r.balance * 100) / 100).toFixed(2);
    const candidate = group.find((other) => {
      if (other.id === r.id) return false;
      const otherPrev = Math.round((other.balance - other.amount) * 100) / 100;
      return otherPrev.toFixed(2) === myKey;
    });
    nextOf.set(r.id, candidate || null);
  }
  // Find chain heads: rows whose prev_balance is NOT any other row's balance in this day.
  const balancesInDay = new Set(group.map((r) => (Math.round(r.balance * 100) / 100).toFixed(2)));
  const heads = group.filter((r) => {
    const prev = Math.round((r.balance - r.amount) * 100) / 100;
    return !balancesInDay.has(prev.toFixed(2));
  });
  if (heads.length === 0) return group;  // Cycle — bail out to insertion order

  // Walk each head forward to build chains
  const chains: any[][] = [];
  const used = new Set<string>();
  for (const head of heads) {
    if (used.has(head.id)) continue;
    const chain: any[] = [];
    let cur: any | null = head;
    while (cur && !used.has(cur.id)) {
      chain.push(cur);
      used.add(cur.id);
      cur = nextOf.get(cur.id) || null;
    }
    chains.push(chain);
  }
  // Any rows not in a chain (shouldn't happen with valid data) — append in insertion order
  const leftover = group.filter((r) => !used.has(r.id));

  // Order chains: for DESC display, the chain whose LAST tx has the highest
  // balance shows first (latest activity on top). For ASC, the chain whose
  // FIRST tx has the lowest prev_balance shows first.
  if (orderDir === 'DESC') {
    chains.sort((a, b) => b[b.length - 1].balance - a[a.length - 1].balance);
    return [...chains.flatMap((c) => [...c].reverse()), ...leftover];
  } else {
    chains.sort((a, b) => (a[0].balance - a[0].amount) - (b[0].balance - b[0].amount));
    return [...chains.flatMap((c) => c), ...leftover];
  }
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

/** Counts of non-internal transactions bucketed by review workflow state. */
export function reviewBucketCounts(): {
  all: number;
  pending: number;
  reviewed: number;
  approved: number;
  escalations: number;
} {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) AS all_count,
      SUM(CASE WHEN review_state IS NULL OR review_state = 'PENDING_REVIEW' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN review_state = 'REVIEWED' THEN 1 ELSE 0 END) AS reviewed_count,
      SUM(CASE WHEN review_state = 'REVIEWED_APPROVED' THEN 1 ELSE 0 END) AS approved_count,
      SUM(CASE WHEN needs_escalation = 1 THEN 1 ELSE 0 END) AS escalation_count
    FROM transactions
    WHERE is_internal = 0
  `).get() as any;
  return {
    all: row.all_count || 0,
    pending: row.pending_count || 0,
    reviewed: row.reviewed_count || 0,
    approved: row.approved_count || 0,
    escalations: row.escalation_count || 0,
  };
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
  budgetId?: string | null;
  fundingCommitmentId?: string | null;
  isSalary?: boolean;
  salaryEntity?: string | null;
  salaryPersonId?: string | null;
  passthroughEntity?: string | null;
  passthroughPurpose?: string | null;
  passthroughPersonId?: string | null;
  passthroughNotes?: string | null;
  fundedByTransactionId?: string | null;
  bookingDateMode?: 'DAY' | 'MONTH' | null;
  isRecurring?: boolean;
  recurringFrequency?: string | null;
  recurringNextDate?: string | null;
  recurringLabel?: string | null;
  recurringAlertDays?: number | null;
  recurringAlertDays2?: number | null;
  recurringExpectedCents?: number | null;
  reviewState?: string | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  needsEscalation?: boolean;
  escalationTo?: string | null;
  escalationNotes?: string | null;
  salaryId?: string | null;
  businessDepartment?: string | null;
  businessCat1Key?: string | null;
  personalCat1Key?: string | null;
  taxTreatment?: string | null;
  taxForm?: string | null;
  autoDetectRule?: boolean;
  cpaReviewedAt?: string | null;
  cpaReviewerName?: string | null;
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
  if (patch.sourceOfMoney !== undefined) {
    fields.push('source_of_money = @source_of_money');
    params.source_of_money = patch.sourceOfMoney;
  }
  if (patch.needToGetFrom !== undefined) { fields.push('need_to_get_from = @need_to_get_from'); params.need_to_get_from = patch.needToGetFrom; }
  if (patch.cpaReviewed !== undefined) { fields.push('cpa_reviewed = @cpa_reviewed'); params.cpa_reviewed = patch.cpaReviewed ? 1 : 0; }
  if (patch.taggedDate !== undefined) { fields.push('tagged_date = @tagged_date'); params.tagged_date = patch.taggedDate; }
  if (patch.sourcePersonId !== undefined) { fields.push('source_person_id = @source_person_id'); params.source_person_id = patch.sourcePersonId; }
  if (patch.sourceBusiness !== undefined) { fields.push('source_business = @source_business'); params.source_business = patch.sourceBusiness; }
  if (patch.sourceAccountId !== undefined) { fields.push('source_account_id = @source_account_id'); params.source_account_id = patch.sourceAccountId; }
  if (patch.budgetId !== undefined) {
    fields.push('budget_id = @budget_id');
    params.budget_id = patch.budgetId;
    // Convenience: if the budget is linked to a funding commitment, mirror that link onto the transaction.
    if (patch.budgetId) {
      const linkedCommitment = db.prepare('SELECT funding_commitment_id FROM budgets WHERE id = ?').get(patch.budgetId) as any;
      if (linkedCommitment?.funding_commitment_id && patch.fundingCommitmentId === undefined) {
        fields.push('funding_commitment_id = @auto_commitment');
        params.auto_commitment = linkedCommitment.funding_commitment_id;
      }
    }
  }
  if ((patch as any).fundingCommitmentId !== undefined) {
    fields.push('funding_commitment_id = @funding_commitment_id');
    params.funding_commitment_id = (patch as any).fundingCommitmentId;
  }
  if (patch.isSalary !== undefined) { fields.push('is_salary = @is_salary'); params.is_salary = patch.isSalary ? 1 : 0; }
  if (patch.salaryEntity !== undefined) { fields.push('salary_entity = @salary_entity'); params.salary_entity = patch.salaryEntity; }
  if (patch.salaryPersonId !== undefined) { fields.push('salary_person_id = @salary_person_id'); params.salary_person_id = patch.salaryPersonId; }
  if (patch.passthroughEntity !== undefined) { fields.push('passthrough_entity = @passthrough_entity'); params.passthrough_entity = patch.passthroughEntity; }
  if (patch.passthroughPurpose !== undefined) { fields.push('passthrough_purpose = @passthrough_purpose'); params.passthrough_purpose = patch.passthroughPurpose; }
  if (patch.passthroughPersonId !== undefined) { fields.push('passthrough_person_id = @passthrough_person_id'); params.passthrough_person_id = patch.passthroughPersonId; }
  if (patch.passthroughNotes !== undefined) { fields.push('passthrough_notes = @passthrough_notes'); params.passthrough_notes = patch.passthroughNotes; }
  if (patch.fundedByTransactionId !== undefined) { fields.push('funded_by_transaction_id = @funded_by_transaction_id'); params.funded_by_transaction_id = patch.fundedByTransactionId; }
  if (patch.bookingDateMode !== undefined) { fields.push('booking_date_mode = @booking_date_mode'); params.booking_date_mode = patch.bookingDateMode; }
  if (patch.isRecurring !== undefined) { fields.push('is_recurring = @is_recurring'); params.is_recurring = patch.isRecurring ? 1 : 0; }
  if (patch.recurringFrequency !== undefined) { fields.push('recurring_frequency = @recurring_frequency'); params.recurring_frequency = patch.recurringFrequency; }
  if (patch.recurringNextDate !== undefined) { fields.push('recurring_next_date = @recurring_next_date'); params.recurring_next_date = patch.recurringNextDate; }
  if (patch.recurringLabel !== undefined) { fields.push('recurring_label = @recurring_label'); params.recurring_label = patch.recurringLabel; }
  if (patch.recurringAlertDays !== undefined) { fields.push('recurring_alert_days = @recurring_alert_days'); params.recurring_alert_days = patch.recurringAlertDays; }
  if (patch.recurringAlertDays2 !== undefined) { fields.push('recurring_alert_days_2 = @recurring_alert_days_2'); params.recurring_alert_days_2 = patch.recurringAlertDays2; }
  if (patch.recurringExpectedCents !== undefined) { fields.push('recurring_expected_cents = @recurring_expected_cents'); params.recurring_expected_cents = patch.recurringExpectedCents; }
  if (patch.reviewState !== undefined) { fields.push('review_state = @review_state'); params.review_state = patch.reviewState; }
  if (patch.reviewerName !== undefined) { fields.push('reviewer_name = @reviewer_name'); params.reviewer_name = patch.reviewerName; }
  if (patch.reviewedAt !== undefined) { fields.push('reviewed_at = @reviewed_at'); params.reviewed_at = patch.reviewedAt; }
  if (patch.needsEscalation !== undefined) { fields.push('needs_escalation = @needs_escalation'); params.needs_escalation = patch.needsEscalation ? 1 : 0; }
  if (patch.escalationTo !== undefined) { fields.push('escalation_to = @escalation_to'); params.escalation_to = patch.escalationTo; }
  if (patch.escalationNotes !== undefined) { fields.push('escalation_notes = @escalation_notes'); params.escalation_notes = patch.escalationNotes; }
  if (patch.salaryId !== undefined) { fields.push('salary_id = @salary_id'); params.salary_id = patch.salaryId; }
  if (patch.businessDepartment !== undefined) { fields.push('business_department = @business_department'); params.business_department = patch.businessDepartment; }
  if (patch.businessCat1Key !== undefined) { fields.push('business_cat1_key = @business_cat1_key'); params.business_cat1_key = patch.businessCat1Key; }
  if (patch.personalCat1Key !== undefined) { fields.push('personal_cat1_key = @personal_cat1_key'); params.personal_cat1_key = patch.personalCat1Key; }
  if (patch.taxTreatment !== undefined) { fields.push('tax_treatment = @tax_treatment'); params.tax_treatment = patch.taxTreatment; }
  if (patch.taxForm !== undefined) { fields.push('tax_form = @tax_form'); params.tax_form = patch.taxForm; }
  if (patch.autoDetectRule !== undefined) { fields.push('auto_detect_rule = @auto_detect_rule'); params.auto_detect_rule = patch.autoDetectRule ? 1 : 0; }
  if (patch.cpaReviewedAt !== undefined) { fields.push('cpa_reviewed_at = @cpa_reviewed_at'); params.cpa_reviewed_at = patch.cpaReviewedAt; }
  if (patch.cpaReviewerName !== undefined) { fields.push('cpa_reviewer_name = @cpa_reviewer_name'); params.cpa_reviewer_name = patch.cpaReviewerName; }
  if (fields.length === 0) return;
  fields.push('updated_at = @updated_at');
  db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = @id`).run(params);
}

/** Find the inflow transaction that an expense was manually linked to via
 *  funded_by_transaction_id. Returns null if the expense isn't linked. */
export function fundedByInflow(txId: string): {
  id: string; postingDate: string; description: string; merchant: string | null;
  amount: number; accountId: string;
} | null {
  const db = getDb();
  const r = db.prepare(`
    SELECT i.id, i.posting_date, i.description, i.merchant_name, i.amount, i.account_id
    FROM transactions t
    JOIN transactions i ON i.id = t.funded_by_transaction_id
    WHERE t.id = ?
  `).get(txId) as any;
  if (!r) return null;
  return {
    id: r.id,
    postingDate: r.posting_date,
    description: r.description,
    merchant: r.merchant_name,
    amount: r.amount,
    accountId: r.account_id,
  };
}

// ===== Manual funding splits =====
// One expense can be funded by multiple inflows (or free-text sources like
// "Personal money", "Pre-import balance"), each with its own dollar amount.

export interface FundingSplit {
  id: string;
  expenseTxId: string;
  sourceTxId: string | null;
  sourceLabel: string | null;
  amountCents: number;
  notes: string | null;
  fromAI: boolean;
  createdAt: number;
  /** Joined inflow snapshot when sourceTxId is set. */
  sourceTx?: {
    postingDate: string;
    description: string;
    merchant: string | null;
    amount: number;
    accountId: string;
  } | null;
}

function rowToSplit(r: any): FundingSplit {
  return {
    id: r.id,
    expenseTxId: r.expense_tx_id,
    sourceTxId: r.source_tx_id ?? null,
    sourceLabel: r.source_label ?? null,
    amountCents: r.amount_cents,
    notes: r.notes ?? null,
    fromAI: !!r.from_ai,
    createdAt: r.created_at,
    sourceTx: r.src_posting_date ? {
      postingDate: r.src_posting_date,
      description: r.src_description,
      merchant: r.src_merchant,
      amount: r.src_amount,
      accountId: r.src_account_id,
    } : null,
  };
}

export function listFundingSplits(expenseTxId: string): FundingSplit[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.*,
      i.posting_date as src_posting_date,
      i.description  as src_description,
      i.merchant_name as src_merchant,
      i.amount       as src_amount,
      i.account_id   as src_account_id
    FROM expense_funding_splits s
    LEFT JOIN transactions i ON i.id = s.source_tx_id
    WHERE s.expense_tx_id = ?
    ORDER BY s.created_at ASC
  `).all(expenseTxId) as any[];
  return rows.map(rowToSplit);
}

export interface FundingSplitInput {
  expenseTxId: string;
  sourceTxId?: string | null;
  sourceLabel?: string | null;
  amountCents: number;
  notes?: string | null;
  fromAI?: boolean;
}

export function addFundingSplit(input: FundingSplitInput): FundingSplit {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO expense_funding_splits (id, expense_tx_id, source_tx_id, source_label, amount_cents, notes, from_ai, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.expenseTxId,
    input.sourceTxId || null,
    input.sourceLabel?.trim() || null,
    input.amountCents,
    input.notes?.trim() || null,
    input.fromAI ? 1 : 0,
    Date.now(),
  );
  const list = listFundingSplits(input.expenseTxId);
  return list.find((s) => s.id === id)!;
}

export function deleteFundingSplit(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM expense_funding_splits WHERE id = ?').run(id);
}

/** Expenses that are funded by a given inflow via the splits table.
 *  Returns one row per linked expense with the portion of THIS expense
 *  attributed to the given inflow. */
export function expensesFundedByInflowViaSplits(inflowTxId: string): Array<{
  expenseTxId: string;
  splitAmountCents: number;
  splitNotes: string | null;
  postingDate: string;
  description: string;
  merchant: string | null;
  expenseAmount: number;
  accountId: string;
  confirmedEntity: string | null;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.expense_tx_id, s.amount_cents as split_amount_cents, s.notes,
      t.posting_date, t.description, t.merchant_name, t.amount, t.account_id,
      t.confirmed_entity, t.entity_tag
    FROM expense_funding_splits s
    JOIN transactions t ON t.id = s.expense_tx_id
    WHERE s.source_tx_id = ?
    ORDER BY t.posting_date DESC, t.id DESC
  `).all(inflowTxId) as any[];
  return rows.map((r) => ({
    expenseTxId: r.expense_tx_id,
    splitAmountCents: r.split_amount_cents,
    splitNotes: r.notes,
    postingDate: r.posting_date,
    description: r.description,
    merchant: r.merchant_name,
    expenseAmount: r.amount,
    accountId: r.account_id,
    confirmedEntity: r.confirmed_entity || r.entity_tag,
  }));
}

/** List expense transactions that the user has manually linked to a given
 *  inflow via funded_by_transaction_id. Used on inflow drawer to show
 *  "this money was used to pay for…" with no FIFO assumption. */
export function expensesFundedByInflow(inflowTxId: string): Array<{
  id: string; postingDate: string; description: string; merchant: string | null;
  amount: number; accountId: string; confirmedEntity: string | null;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, posting_date, description, merchant_name, amount, account_id, confirmed_entity, entity_tag
    FROM transactions
    WHERE funded_by_transaction_id = ?
    ORDER BY posting_date DESC, id DESC
  `).all(inflowTxId) as any[];
  return rows.map((r) => ({
    id: r.id,
    postingDate: r.posting_date,
    description: r.description,
    merchant: r.merchant_name,
    amount: r.amount,
    accountId: r.account_id,
    confirmedEntity: r.confirmed_entity || r.entity_tag,
  }));
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
  /** Sum of expenses booked on this entity but tagged as passthrough to another entity (e.g. salary you took to fund another LLC). Subtract from this entity's "real" hit. */
  passthroughOut: number;
  /** Sum of expenses booked on OTHER entities but tagged as passthrough INTO this entity (e.g. partner-funded debt repayment). Add to this entity's "real" hit. */
  passthroughIn: number;
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

  // Passthrough totals (amount flagged as "actually belongs to a different entity")
  const passthroughOut = db.prepare(`
    SELECT COALESCE(confirmed_entity, entity_tag) as entity, SUM(ABS(amount)) as total
    FROM transactions
    WHERE amount < 0 AND is_internal = 0 AND passthrough_entity IS NOT NULL
      ${where.length ? 'AND ' + where.join(' AND ') : ''}
    GROUP BY entity
  `).all(p) as any[];
  const outByEntity = new Map<string, number>();
  for (const r of passthroughOut) outByEntity.set(r.entity, r.total);

  const passthroughIn = db.prepare(`
    SELECT passthrough_entity as entity, SUM(ABS(amount)) as total
    FROM transactions
    WHERE amount < 0 AND is_internal = 0 AND passthrough_entity IS NOT NULL
      ${where.length ? 'AND ' + where.join(' AND ') : ''}
    GROUP BY passthrough_entity
  `).all(p) as any[];
  const inByEntity = new Map<string, number>();
  for (const r of passthroughIn) inByEntity.set(r.entity, r.total);

  // Make sure entities that ONLY appear as passthrough targets still show up in the result
  const allEntities = new Set<string>(agg.map((r) => r.entity));
  for (const ent of inByEntity.keys()) allEntities.add(ent);

  return Array.from(allEntities).map((entityKey) => {
    const r = agg.find((x) => x.entity === entityKey) || { entity: entityKey, income: 0, expenses: 0 };
    return {
      entity: entityKey as EntityType,
      income: r.income || 0,
      expenses: r.expenses || 0,
      net: (r.income || 0) - (r.expenses || 0),
      topExpenseCategories: (byEntityCat.get(entityKey) || [])
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4),
      passthroughOut: outByEntity.get(entityKey) || 0,
      passthroughIn: inByEntity.get(entityKey) || 0,
    };
  });
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
