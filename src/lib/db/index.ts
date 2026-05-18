import 'server-only';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ACCOUNTS } from '@/constants/accounts';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'amari.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      last4 TEXT NOT NULL,
      entity TEXT NOT NULL,
      label TEXT NOT NULL,
      purpose TEXT NOT NULL,
      color TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      imported_at INTEGER NOT NULL,
      row_count INTEGER NOT NULL,
      date_range_from TEXT,
      date_range_to TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      posting_date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT,
      balance REAL,
      merchant_name TEXT,
      category TEXT NOT NULL,
      entity_tag TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 0,
      internal_linked_id TEXT,
      income_source TEXT,
      confirmed_entity TEXT,
      confirmed_category TEXT,
      business_purpose TEXT,
      receipt_ref TEXT,
      audit_status TEXT NOT NULL DEFAULT 'UNREVIEWED',
      audit_flags TEXT NOT NULL DEFAULT '[]',
      audit_score INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      zelle_person TEXT,
      zelle_type TEXT,
      imported_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      import_batch_id TEXT NOT NULL REFERENCES import_batches(id),
      hash TEXT NOT NULL UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id, posting_date DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(audit_status);
    CREATE INDEX IF NOT EXISTS idx_tx_entity ON transactions(entity_tag);
    CREATE INDEX IF NOT EXISTS idx_tx_score ON transactions(audit_score DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_internal ON transactions(is_internal);

    CREATE TABLE IF NOT EXISTS reconciliation_matches (
      id TEXT PRIMARY KEY,
      from_tx_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      to_tx_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      confidence REAL NOT NULL,
      matched_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'AUTO_MATCHED'
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'OTHER',
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_people_role ON people(role);

    CREATE TABLE IF NOT EXISTS equity_holdings (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      percent REAL NOT NULL CHECK (percent >= 0 AND percent <= 100),
      shares INTEGER,
      grant_date TEXT,
      vesting_cliff_months INTEGER,
      vesting_total_months INTEGER,
      vesting_start TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_equity_entity ON equity_holdings(entity);
    CREATE INDEX IF NOT EXISTS idx_equity_person ON equity_holdings(person_id);

    CREATE TABLE IF NOT EXISTS cash_contributions (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      contribution_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'CASH',
      linked_transaction_id TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contrib_entity ON cash_contributions(entity, contribution_date DESC);
    CREATE INDEX IF NOT EXISTS idx_contrib_person ON cash_contributions(person_id);

    CREATE TABLE IF NOT EXISTS safe_notes (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      issue_date TEXT NOT NULL,
      valuation_cap_cents INTEGER,
      discount_pct REAL,
      mfn INTEGER NOT NULL DEFAULT 0,
      note_type TEXT NOT NULL DEFAULT 'SAFE',
      interest_rate_pct REAL,
      maturity_date TEXT,
      status TEXT NOT NULL DEFAULT 'OUTSTANDING',
      converted_at TEXT,
      converted_holding_id TEXT REFERENCES equity_holdings(id) ON DELETE SET NULL,
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_safe_entity ON safe_notes(entity);
    CREATE INDEX IF NOT EXISTS idx_safe_person ON safe_notes(person_id);
    CREATE INDEX IF NOT EXISTS idx_safe_status ON safe_notes(status);

    CREATE TABLE IF NOT EXISTS entity_valuations (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      valuation_cents INTEGER NOT NULL CHECK (valuation_cents > 0),
      as_of_date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'MANUAL',
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_val_entity ON entity_valuations(entity, as_of_date DESC);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'PARTNER',
      person_id TEXT REFERENCES people(id) ON DELETE SET NULL,
      failed_login_count INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_person ON users(person_id);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      ip TEXT,
      user_agent TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS invite_tokens (
      token TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'PARTNER',
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      used_at INTEGER,
      used_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invite_person ON invite_tokens(person_id);

    CREATE TABLE IF NOT EXISTS transaction_splits (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      entity TEXT NOT NULL DEFAULT 'UNKNOWN',
      category TEXT,
      individual TEXT,
      sub_category_1 TEXT,
      sub_category_2 TEXT,
      business_purpose TEXT,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_splits_tx ON transaction_splits(transaction_id);

    CREATE TABLE IF NOT EXISTS funding_commitments (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents > 0),
      monthly_amount_cents INTEGER,
      equity_percent REAL,
      equity_holding_id TEXT REFERENCES equity_holdings(id) ON DELETE SET NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_commit_entity ON funding_commitments(entity);
    CREATE INDEX IF NOT EXISTS idx_commit_person ON funding_commitments(person_id);

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      entity TEXT,
      kind TEXT NOT NULL DEFAULT 'EXPENSE',
      monthly_amount_cents INTEGER,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_budgets_status ON budgets(status);
    CREATE INDEX IF NOT EXISTS idx_budgets_entity ON budgets(entity);

    CREATE TABLE IF NOT EXISTS field_options (
      id TEXT PRIMARY KEY,
      field TEXT NOT NULL,
      value TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE (field, value) ON CONFLICT IGNORE
    );
    CREATE INDEX IF NOT EXISTS idx_field_options_field ON field_options(field, sort_order);

    CREATE TABLE IF NOT EXISTS salaries (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      entity TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'SALARY',
      monthly_amount_cents INTEGER NOT NULL,
      label TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_salaries_entity ON salaries(entity);
    CREATE INDEX IF NOT EXISTS idx_salaries_person ON salaries(person_id);

    CREATE TABLE IF NOT EXISTS expense_funding_splits (
      id TEXT PRIMARY KEY,
      expense_tx_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      source_tx_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      source_label TEXT,
      amount_cents INTEGER NOT NULL,
      notes TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_funding_split_expense ON expense_funding_splits(expense_tx_id);
    CREATE INDEX IF NOT EXISTS idx_funding_split_source ON expense_funding_splits(source_tx_id);
  `);

  // Forward-compatible column adds (SQLite ALTER ignores if column exists in some versions; we catch)
  for (const sql of [
    `ALTER TABLE equity_holdings ADD COLUMN holder_type TEXT NOT NULL DEFAULT 'PARTNER'`,
    `ALTER TABLE transactions ADD COLUMN individual TEXT`,
    `ALTER TABLE transactions ADD COLUMN sub_category_1 TEXT`,
    `ALTER TABLE transactions ADD COLUMN sub_category_2 TEXT`,
    `ALTER TABLE transactions ADD COLUMN source_of_money TEXT`,
    `ALTER TABLE transactions ADD COLUMN need_to_get_from TEXT`,
    `ALTER TABLE transactions ADD COLUMN cpa_reviewed INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE transactions ADD COLUMN tagged_date TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN period_start TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN period_end TEXT`,
    `ALTER TABLE transactions ADD COLUMN source_person_id TEXT REFERENCES people(id) ON DELETE SET NULL`,
    `ALTER TABLE transactions ADD COLUMN transaction_date TEXT`,
    `ALTER TABLE transactions ADD COLUMN funding_commitment_id TEXT REFERENCES funding_commitments(id) ON DELETE SET NULL`,
    `ALTER TABLE transactions ADD COLUMN source_business TEXT`,
    `ALTER TABLE transactions ADD COLUMN source_account_id TEXT`,
    `ALTER TABLE transactions ADD COLUMN budget_id TEXT REFERENCES budgets(id) ON DELETE SET NULL`,
    `ALTER TABLE budgets ADD COLUMN period_month TEXT`,
    `ALTER TABLE budgets ADD COLUMN funding_commitment_id TEXT REFERENCES funding_commitments(id) ON DELETE SET NULL`,
    `ALTER TABLE budgets ADD COLUMN sub_kind TEXT`,
    `ALTER TABLE budgets ADD COLUMN person_id TEXT REFERENCES people(id) ON DELETE SET NULL`,
    `ALTER TABLE budgets ADD COLUMN total_amount_cents INTEGER`,
    `ALTER TABLE budgets ADD COLUMN runway_months INTEGER`,
    `ALTER TABLE transactions ADD COLUMN is_salary INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE transactions ADD COLUMN salary_entity TEXT`,
    `ALTER TABLE transactions ADD COLUMN salary_person_id TEXT REFERENCES people(id) ON DELETE SET NULL`,
    `ALTER TABLE transactions ADD COLUMN passthrough_entity TEXT`,
    `ALTER TABLE transactions ADD COLUMN passthrough_purpose TEXT`,
    `ALTER TABLE transactions ADD COLUMN passthrough_person_id TEXT REFERENCES people(id) ON DELETE SET NULL`,
    `ALTER TABLE transactions ADD COLUMN passthrough_notes TEXT`,
    `ALTER TABLE field_options ADD COLUMN parent_value TEXT`,
    `ALTER TABLE transactions ADD COLUMN funded_by_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL`,
    `ALTER TABLE transactions ADD COLUMN booking_date_mode TEXT`,
    `ALTER TABLE transactions ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE transactions ADD COLUMN recurring_frequency TEXT`,
    `ALTER TABLE transactions ADD COLUMN recurring_next_date TEXT`,
    `ALTER TABLE transactions ADD COLUMN recurring_label TEXT`,
    `ALTER TABLE transactions ADD COLUMN recurring_alert_days INTEGER`,
    `ALTER TABLE transactions ADD COLUMN business_department TEXT`,
    `ALTER TABLE transactions ADD COLUMN business_cat1_key TEXT`,
    `ALTER TABLE transactions ADD COLUMN personal_cat1_key TEXT`,
    `ALTER TABLE transactions ADD COLUMN tax_treatment TEXT`,
    `ALTER TABLE transactions ADD COLUMN tax_form TEXT`,
    `ALTER TABLE transactions ADD COLUMN auto_detect_rule INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE transactions ADD COLUMN cpa_reviewed_at TEXT`,
    `ALTER TABLE transactions ADD COLUMN cpa_reviewer_name TEXT`,
    `ALTER TABLE transactions ADD COLUMN recurring_expected_cents INTEGER`,
    `ALTER TABLE expense_funding_splits ADD COLUMN from_ai INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE transaction_splits ADD COLUMN source_entity TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN source_account_id TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE transaction_splits ADD COLUMN recurring_frequency TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN recurring_next_date TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN recurring_label TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN recurring_alert_days INTEGER`,
    `ALTER TABLE transaction_splits ADD COLUMN recurring_expected_cents INTEGER`,
    `ALTER TABLE transaction_splits ADD COLUMN need_to_get_from TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN hop2_person TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN hop3_entity TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN passed_onward INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE transaction_splits ADD COLUMN passthrough_entity TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN passthrough_purpose TEXT`,
    `ALTER TABLE transaction_splits ADD COLUMN passthrough_notes TEXT`,
    `ALTER TABLE transactions ADD COLUMN recurring_alert_days_2 INTEGER`,
    `ALTER TABLE transaction_splits ADD COLUMN recurring_alert_days_2 INTEGER`,
    `ALTER TABLE transactions ADD COLUMN review_state TEXT`,
    `ALTER TABLE transactions ADD COLUMN reviewer_name TEXT`,
    `ALTER TABLE transactions ADD COLUMN reviewed_at TEXT`,
    `ALTER TABLE transactions ADD COLUMN needs_escalation INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE transactions ADD COLUMN escalation_to TEXT`,
    `ALTER TABLE transactions ADD COLUMN escalation_notes TEXT`,
    `ALTER TABLE transactions ADD COLUMN salary_id TEXT REFERENCES salaries(id) ON DELETE SET NULL`,
    `ALTER TABLE transaction_splits ADD COLUMN salary_id TEXT REFERENCES salaries(id) ON DELETE SET NULL`,
    `ALTER TABLE transaction_splits ADD COLUMN budget_id TEXT REFERENCES budgets(id) ON DELETE SET NULL`,
  ]) {
    try { db.exec(sql); } catch (_e) { /* column already present */ }
  }

  // Seed accounts on first run
  const count = (db.prepare('SELECT COUNT(*) as c FROM accounts').get() as { c: number }).c;
  if (count === 0) {
    const insert = db.prepare(
      `INSERT INTO accounts (id, last4, entity, label, purpose, color, is_active)
       VALUES (@id, @last4, @entity, @label, @purpose, @color, @is_active)`
    );
    const tx = db.transaction(() => {
      for (const a of ACCOUNTS) {
        insert.run({
          id: a.id,
          last4: a.last4,
          entity: a.entity,
          label: a.label,
          purpose: a.purpose,
          color: a.color,
          is_active: a.isActive ? 1 : 0,
        });
      }
    });
    tx();
  }

  _db = db;
  // One-time seed of default dropdown options. Idempotent via UNIQUE(field, value).
  // Import lazily to avoid a circular dependency through options.ts -> getDb.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { seedDefaultOptions } = require('./seed-options');
    seedDefaultOptions();
  } catch { /* swallow — seeding is optional */ }
  return db;
}
