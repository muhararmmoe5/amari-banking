'use strict';

const express = require('express');
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');

const db = require('../db');
const { audit } = require('../lib/audit');

const router = express.Router();

const listAccounts = db.prepare(
  'SELECT id, account_number, name, balance_cents, currency, created_at FROM accounts WHERE user_id = ? ORDER BY id ASC'
);
const getAccountForUser = db.prepare(
  'SELECT id, account_number, name, balance_cents, currency, created_at FROM accounts WHERE id = ? AND user_id = ?'
);
const insertAccount = db.prepare(
  `INSERT INTO accounts (user_id, account_number, name, balance_cents, currency, created_at)
   VALUES (@user_id, @account_number, @name, 0, 'USD', @created_at)`
);
const countAccounts = db.prepare('SELECT COUNT(*) as c FROM accounts WHERE user_id = ?');

function generateAccountNumber() {
  // 12-digit pseudo-random account number, cryptographically secure
  const buf = crypto.randomBytes(8);
  const n = buf.readBigUInt64BE() % 1000000000000n;
  return String(n).padStart(12, '0');
}

router.get('/', (req, res) => {
  const rows = listAccounts.all(req.session.userId);
  res.json({ accounts: rows });
});

router.post(
  '/',
  body('name').isString().trim().isLength({ min: 1, max: 64 }).matches(/^[\w\s\-\.]+$/),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'invalid_input' });

    const userId = req.session.userId;
    const { c } = countAccounts.get(userId);
    if (c >= 10) return res.status(409).json({ error: 'account_limit_reached' });

    // Retry on the astronomically unlikely collision
    let attempt = 0;
    while (attempt < 5) {
      const account_number = generateAccountNumber();
      try {
        const info = insertAccount.run({
          user_id: userId,
          account_number,
          name: req.body.name,
          created_at: Date.now(),
        });
        audit(req, 'account.create', { account_id: info.lastInsertRowid });
        const account = getAccountForUser.get(info.lastInsertRowid, userId);
        return res.status(201).json({ account });
      } catch (err) {
        if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          attempt += 1;
          continue;
        }
        throw err;
      }
    }
    res.status(500).json({ error: 'account_creation_failed' });
  }
);

router.get(
  '/:id',
  param('id').isInt({ min: 1 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'invalid_input' });
    const account = getAccountForUser.get(parseInt(req.params.id, 10), req.session.userId);
    if (!account) return res.status(404).json({ error: 'not_found' });
    res.json({ account });
  }
);

module.exports = router;
