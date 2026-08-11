import 'server-only';
import crypto from 'crypto';
import { getDb } from './index';
import { computeFingerprint, normalizeMerchant } from './fingerprint';

/** Fields a Plaid sync is allowed to mutate on an existing transaction row.
 *
 *  Anything NOT in this list — confirmed_entity, sub_category_*, business_*,
 *  personal_*, individual, salary_id, budget_id, funding_commitment_id,
 *  review_*, notes, receipt_ref, audit_*, tagged_date, recurring_*, salary_*,
 *  passthrough_*, escalation_*, etc. — is preserved untouched on merge.
 *
 *  CLAUDE.md rule #4: 'Never overwrite manual tags during sync.' This list
 *  is the canonical enforcement of that rule. Adding a column to it
 *  requires explicit review. */
const PLAID_MUTABLE_COLUMNS = new Set([
  'source',
  'external_id',
  'merchant_name',
  'merchant_normalized',
  'raw_data',
  'pending',
  'pending_external_id',
  'balance',
  'updated_at',
]);

export interface PlaidTransaction {
  /** Plaid transaction_id — stable per posted transaction. */
  transactionId: string;
  /** Plaid account_id — must resolve to a row in our accounts table. */
  accountId: string;
  /** Posted date (or authorized date for pending). YYYY-MM-DD. */
  date: string;
  /** Plaid's merchant display name. */
  name: string;
  /** Plaid's normalized merchant if available, else falls back to `name`. */
  merchantName?: string | null;
  /** Outflow = positive in Plaid; we flip to match our convention (outflow=negative). */
  amount: number;
  pending: boolean;
  /** Pointer to the matching `pending=true` row this one supersedes, when posted. */
  pendingTransactionId?: string | null;
  /** Full Plaid payload — stored as raw_data jsonb for debugging / future fields. */
  raw: unknown;
}

export interface PlaidSyncCounts {
  inserted: number;
  merged: number;
  duplicate: number;
  skipped: number;
}

/** Find an existing transaction on the same account whose fingerprint matches
 *  Plaid's row within ±2 days. CLAUDE.md spec: this is the merge primitive. */
function findMatchByFingerprint(
  accountId: string,
  fingerprint: string,
  date: string,
): { id: string; source: string; external_id: string | null } | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, source, external_id
    FROM transactions
    WHERE account_id = ?
      AND fingerprint = ?
      AND ABS(julianday(posting_date) - julianday(?)) <= 2
    ORDER BY ABS(julianday(posting_date) - julianday(?)) ASC
    LIMIT 1
  `).get(accountId, fingerprint, date, date) as any;
  return row || null;
}

/** Start an ingestion log row. Returns the log id. */
export function startIngestion(source: 'csv' | 'plaid', identifier: string | null): string {
  const id = crypto.randomUUID();
  getDb().prepare(`
    INSERT INTO ingestion_log (id, source, identifier, started_at)
    VALUES (?, ?, ?, ?)
  `).run(id, source, identifier, Date.now());
  return id;
}

export function finishIngestion(logId: string, counts: PlaidSyncCounts, notes?: string): void {
  getDb().prepare(`
    UPDATE ingestion_log SET
      completed_at = ?, records_inserted = ?, records_merged = ?,
      records_duplicate = ?, records_skipped = ?, notes = ?
    WHERE id = ?
  `).run(Date.now(), counts.inserted, counts.merged, counts.duplicate, counts.skipped, notes || null, logId);
}

/** Apply a single Plaid transaction to the local database.
 *
 *  Branches:
 *  1. No existing match → insert net-new with source='plaid'.
 *  2. Existing source='csv' match → MERGE: promote to source='plaid', set
 *     external_id, refresh merchant/raw_data, leave EVERY tagging column
 *     untouched. This is how manual work done on CSV imports survives.
 *  3. Existing source='plaid' with same external_id → DUPLICATE: refresh
 *     mutable fields only (pending state, balance, raw_data).
 *  4. Existing source='plaid' with different external_id → INSERT new
 *     (fingerprint collision; two real transactions look identical).
 *
 *  Returns the branch taken so the caller can update counts. */
/**
 * Every INSERT into transactions must reference an import_batches row
 * (import_batch_id is NOT NULL in the schema). Plaid syncs previously
 * passed NULL, which meant the first real Plaid ingestion would throw
 * `NOT NULL constraint failed: transactions.import_batch_id`. We now
 * lazily create a per-account 'plaid-sync' batch and reuse it.
 */
const _plaidBatchCache = new Map<string, string>();
function ensurePlaidBatch(accountId: string): string {
  const db = getDb();
  const cached = _plaidBatchCache.get(accountId);
  if (cached) return cached;
  const existing = db.prepare(
    `SELECT id FROM import_batches WHERE file_name = 'plaid-sync' AND account_id = ? LIMIT 1`
  ).get(accountId) as { id: string } | undefined;
  if (existing) { _plaidBatchCache.set(accountId, existing.id); return existing.id; }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO import_batches (id, file_name, account_id, imported_at, row_count, date_range_from, date_range_to)
     VALUES (?, 'plaid-sync', ?, ?, 0, NULL, NULL)`
  ).run(id, accountId, Date.now());
  _plaidBatchCache.set(accountId, id);
  return id;
}

export function applyPlaidTransaction(p: PlaidTransaction): 'inserted' | 'merged' | 'duplicate' {
  const db = getDb();
  const fingerprint = computeFingerprint(p.amount, p.date, p.merchantName || p.name);
  const existing = findMatchByFingerprint(p.accountId, fingerprint, p.date);

  const merchantNormalized = normalizeMerchant(p.merchantName || p.name);
  const now = Date.now();
  const batchId = ensurePlaidBatch(p.accountId);

  if (!existing) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO transactions (
        id, account_id, posting_date, description, amount, type, balance,
        merchant_name, merchant_normalized, category, entity_tag,
        is_internal, source, external_id, raw_data, fingerprint,
        pending, pending_external_id,
        audit_status, audit_flags, audit_score,
        imported_at, updated_at, import_batch_id, hash
      ) VALUES (
        @id, @accountId, @date, @description, @amount, NULL, NULL,
        @merchantName, @merchantNormalized, 'UNCATEGORIZED', 'UNKNOWN',
        0, 'plaid', @externalId, @rawData, @fingerprint,
        @pending, @pendingExternalId,
        'UNREVIEWED', '[]', 0,
        @now, @now, @batchId, @fingerprint
      )
    `).run({
      id,
      accountId: p.accountId,
      date: p.date,
      description: p.name,
      amount: p.amount,
      merchantName: p.merchantName || p.name,
      batchId,
      merchantNormalized,
      externalId: p.transactionId,
      rawData: JSON.stringify(p.raw),
      fingerprint,
      pending: p.pending ? 1 : 0,
      pendingExternalId: p.pendingTransactionId || null,
      now,
    });
    return 'inserted';
  }

  if (existing.source === 'csv') {
    // MERGE — promote to Plaid, preserve every manual tag.
    // PLAID_MUTABLE_COLUMNS is the only set of columns we touch.
    db.prepare(`
      UPDATE transactions SET
        source = 'plaid',
        external_id = ?,
        merchant_name = ?,
        merchant_normalized = ?,
        raw_data = ?,
        pending = ?,
        pending_external_id = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      p.transactionId,
      p.merchantName || p.name,
      merchantNormalized,
      JSON.stringify(p.raw),
      p.pending ? 1 : 0,
      p.pendingTransactionId || null,
      now,
      existing.id,
    );
    return 'merged';
  }

  if (existing.source === 'plaid' && existing.external_id === p.transactionId) {
    // DUPLICATE — same Plaid row, refresh mutable fields only.
    db.prepare(`
      UPDATE transactions SET
        pending = ?,
        raw_data = ?,
        merchant_name = ?,
        merchant_normalized = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      p.pending ? 1 : 0,
      JSON.stringify(p.raw),
      p.merchantName || p.name,
      merchantNormalized,
      now,
      existing.id,
    );
    return 'duplicate';
  }

  // existing.source === 'plaid' && existing.external_id !== p.transactionId
  // Fingerprint collision (e.g. two identical $5 coffees). Insert net-new.
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO transactions (
      id, account_id, posting_date, description, amount, type, balance,
      merchant_name, merchant_normalized, category, entity_tag,
      is_internal, source, external_id, raw_data, fingerprint,
      pending, pending_external_id,
      audit_status, audit_flags, audit_score,
      imported_at, updated_at, import_batch_id, hash
    ) VALUES (
      @id, @accountId, @date, @description, @amount, NULL, NULL,
      @merchantName, @merchantNormalized, 'UNCATEGORIZED', 'UNKNOWN',
      0, 'plaid', @externalId, @rawData, @fingerprint,
      @pending, @pendingExternalId,
      'UNREVIEWED', '[]', 0,
      @now, @now, @batchId, @collisionHash
    )
  `).run({
    id,
    accountId: p.accountId,
    date: p.date,
    description: p.name,
    amount: p.amount,
    merchantName: p.merchantName || p.name,
    merchantNormalized,
    externalId: p.transactionId,
    rawData: JSON.stringify(p.raw),
    fingerprint,
    pending: p.pending ? 1 : 0,
    pendingExternalId: p.pendingTransactionId || null,
    // hash column has a UNIQUE constraint — append the Plaid id to avoid collision.
    collisionHash: `${fingerprint}:${p.transactionId}`,
    now,
    batchId,
  });
  return 'inserted';
}

/** After a full Plaid sync, list CSV-source transactions in the coverage
 *  window that Plaid did NOT report. These are orphan candidates the user
 *  must review (CLAUDE.md spec — do NOT auto-delete). */
export function findOrphanCSVTransactions(coverageStart: string, coverageEnd: string): Array<{
  id: string; date: string; description: string; amount: number; accountId: string;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, posting_date as date, description, amount, account_id as accountId
    FROM transactions
    WHERE source = 'csv'
      AND posting_date >= ?
      AND posting_date <= ?
    ORDER BY posting_date DESC
  `).all(coverageStart, coverageEnd) as any[];
  return rows;
}

/** Returns the set of column names a Plaid sync is allowed to mutate. */
export function plaidMutableColumns(): ReadonlySet<string> {
  return PLAID_MUTABLE_COLUMNS;
}
