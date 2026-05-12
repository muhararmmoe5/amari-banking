'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(path.resolve(config.dbPath)), { recursive: true });

const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deposit','withdrawal','transfer_in','transfer_out')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    balance_after_cents INTEGER NOT NULL,
    counterparty_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    details TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at DESC);
`);

module.exports = db;
