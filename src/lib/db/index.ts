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
  `);

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
  return db;
}
