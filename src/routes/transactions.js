'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');

const db = require('../db');
const config = require('../config');
const { parseAmountToCents } = require('../lib/money');
const { audit } = require('../lib/audit');

const router = express.Router();

const movementLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const getAccountForUser = db.prepare(
  'SELECT id, balance_cents FROM accounts WHERE id = ? AND user_id = ?'
);
const getAccountByNumber = db.prepare(
  'SELECT id, user_id, balance_cents FROM accounts WHERE account_number = ?'
);
const updateBalance = db.prepare('UPDATE accounts SET balance_cents = ? WHERE id = ?');
const insertTx = db.prepare(
  `INSERT INTO transactions (account_id, type, amount_cents, balance_after_cents, counterparty_account_id, description, created_at)
   VALUES (@account_id, @type, @amount_cents, @balance_after_cents, @counterparty_account_id, @description, @created_at)`
);
const listTxByAccount = db.prepare(
  `SELECT id, type, amount_cents, balance_after_cents, counterparty_account_id, description, created_at
   FROM transactions WHERE account_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`
);

function ownedAccountOr404(accountId, userId) {
  return getAccountForUser.get(accountId, userId);
}

router.post(
  '/deposit',
  movementLimiter,
  body('account_id').isInt({ min: 1 }),
  body('amount').isString().isLength({ max: 24 }),
  body('description').optional().isString().isLength({ max: 140 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'invalid_input' });

    const cents = parseAmountToCents(req.body.amount);
    if (!cents) return res.status(400).json({ error: 'invalid_amount' });
    if (cents > config.transferMaxCents) return res.status(400).json({ error: 'amount_too_large' });

    const accountId = parseInt(req.body.account_id, 10);
    const userId = req.session.userId;

    const result = db.transaction(() => {
      const account = ownedAccountOr404(accountId, userId);
      if (!account) return { error: 'not_found' };
      const newBalance = account.balance_cents + cents;
      if (!Number.isSafeInteger(newBalance)) return { error: 'balance_overflow' };
      updateBalance.run(newBalance, account.id);
      insertTx.run({
        account_id: account.id,
        type: 'deposit',
        amount_cents: cents,
        balance_after_cents: newBalance,
        counterparty_account_id: null,
        description: req.body.description || null,
        created_at: Date.now(),
      });
      return { newBalance };
    })();

    if (result.error === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (result.error) return res.status(500).json({ error: result.error });
    audit(req, 'tx.deposit', { account_id: accountId, amount_cents: cents });
    res.status(201).json({ ok: true, balance_cents: result.newBalance });
  }
);

router.post(
  '/withdraw',
  movementLimiter,
  body('account_id').isInt({ min: 1 }),
  body('amount').isString().isLength({ max: 24 }),
  body('description').optional().isString().isLength({ max: 140 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'invalid_input' });

    const cents = parseAmountToCents(req.body.amount);
    if (!cents) return res.status(400).json({ error: 'invalid_amount' });
    if (cents > config.transferMaxCents) return res.status(400).json({ error: 'amount_too_large' });

    const accountId = parseInt(req.body.account_id, 10);
    const userId = req.session.userId;

    const result = db.transaction(() => {
      const account = ownedAccountOr404(accountId, userId);
      if (!account) return { error: 'not_found' };
      if (account.balance_cents < cents) return { error: 'insufficient_funds' };
      const newBalance = account.balance_cents - cents;
      updateBalance.run(newBalance, account.id);
      insertTx.run({
        account_id: account.id,
        type: 'withdrawal',
        amount_cents: cents,
        balance_after_cents: newBalance,
        counterparty_account_id: null,
        description: req.body.description || null,
        created_at: Date.now(),
      });
      return { newBalance };
    })();

    if (result.error === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (result.error === 'insufficient_funds') return res.status(400).json({ error: 'insufficient_funds' });
    if (result.error) return res.status(500).json({ error: result.error });
    audit(req, 'tx.withdraw', { account_id: accountId, amount_cents: cents });
    res.status(201).json({ ok: true, balance_cents: result.newBalance });
  }
);

router.post(
  '/transfer',
  movementLimiter,
  body('from_account_id').isInt({ min: 1 }),
  body('to_account_number').isString().trim().matches(/^\d{12}$/),
  body('amount').isString().isLength({ max: 24 }),
  body('description').optional().isString().isLength({ max: 140 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'invalid_input' });

    const cents = parseAmountToCents(req.body.amount);
    if (!cents) return res.status(400).json({ error: 'invalid_amount' });
    if (cents > config.transferMaxCents) return res.status(400).json({ error: 'amount_too_large' });

    const fromId = parseInt(req.body.from_account_id, 10);
    const toNumber = req.body.to_account_number;
    const userId = req.session.userId;

    const result = db.transaction(() => {
      const from = ownedAccountOr404(fromId, userId);
      if (!from) return { error: 'not_found' };
      const to = getAccountByNumber.get(toNumber);
      if (!to) return { error: 'destination_not_found' };
      if (to.id === from.id) return { error: 'same_account' };
      if (from.balance_cents < cents) return { error: 'insufficient_funds' };
      const fromNew = from.balance_cents - cents;
      const toNew = to.balance_cents + cents;
      if (!Number.isSafeInteger(toNew)) return { error: 'balance_overflow' };
      updateBalance.run(fromNew, from.id);
      updateBalance.run(toNew, to.id);
      const now = Date.now();
      insertTx.run({
        account_id: from.id,
        type: 'transfer_out',
        amount_cents: cents,
        balance_after_cents: fromNew,
        counterparty_account_id: to.id,
        description: req.body.description || null,
        created_at: now,
      });
      insertTx.run({
        account_id: to.id,
        type: 'transfer_in',
        amount_cents: cents,
        balance_after_cents: toNew,
        counterparty_account_id: from.id,
        description: req.body.description || null,
        created_at: now,
      });
      return { fromNew };
    })();

    if (result.error === 'not_found' || result.error === 'destination_not_found') {
      // Don't leak whether destination exists — generic 404 from caller's POV
      return res.status(404).json({ error: 'not_found' });
    }
    if (result.error === 'same_account') return res.status(400).json({ error: 'same_account' });
    if (result.error === 'insufficient_funds') return res.status(400).json({ error: 'insufficient_funds' });
    if (result.error) return res.status(500).json({ error: result.error });
    audit(req, 'tx.transfer', { from_account_id: fromId, to_account_number: toNumber, amount_cents: cents });
    res.status(201).json({ ok: true, balance_cents: result.fromNew });
  }
);

router.get(
  '/account/:id',
  param('id').isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0, max: 100000 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'invalid_input' });
    const accountId = parseInt(req.params.id, 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    const account = ownedAccountOr404(accountId, req.session.userId);
    if (!account) return res.status(404).json({ error: 'not_found' });
    const rows = listTxByAccount.all(account.id, limit, offset);
    res.json({ transactions: rows });
  }
);

module.exports = router;
