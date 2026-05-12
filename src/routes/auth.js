'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const db = require('../db');
const config = require('../config');
const { validatePasswordPolicy, hashPassword, verifyPassword } = require('../lib/password');
const { audit } = require('../lib/audit');
const { ensureCsrfToken } = require('../middleware/csrf');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const findUserById = db.prepare('SELECT id, username, email FROM users WHERE id = ?');
const findUserByUsername = db.prepare(
  'SELECT id, username, email, password_hash, failed_login_count, locked_until FROM users WHERE username = ?'
);
const insertUser = db.prepare(
  `INSERT INTO users (username, email, password_hash, created_at, updated_at)
   VALUES (@username, @email, @password_hash, @now, @now)`
);
const updateLoginSuccess = db.prepare(
  'UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?'
);
const updateLoginFailure = db.prepare(
  'UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?'
);

function publicUser(u) {
  return { id: u.id, username: u.username, email: u.email };
}

function genericLoginError(res) {
  return res.status(401).json({ error: 'invalid_credentials' });
}

router.get('/csrf-token', (req, res) => {
  const token = ensureCsrfToken(req);
  res.json({ csrfToken: token });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'authentication_required' });
  }
  const user = findUserById.get(req.session.userId);
  if (!user) {
    return req.session.destroy(() => res.status(401).json({ error: 'authentication_required' }));
  }
  res.json({ user: publicUser(user) });
});

router.post(
  '/register',
  registerLimiter,
  body('username').isString().trim().isLength({ min: 3, max: 32 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isString().trim().isEmail().isLength({ max: 254 }).normalizeEmail(),
  body('password').isString().isLength({ min: config.passwordMinLength, max: config.passwordMaxLength }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'invalid_input' });
      }
      const { username, email, password } = req.body;
      const policyError = validatePasswordPolicy(password);
      if (policyError) {
        return res.status(400).json({ error: 'weak_password', message: policyError });
      }
      const password_hash = await hashPassword(password);
      let userId;
      try {
        const info = insertUser.run({ username, email, password_hash, now: Date.now() });
        userId = info.lastInsertRowid;
      } catch (err) {
        if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          // Generic message to avoid user-enumeration
          return res.status(409).json({ error: 'registration_unavailable' });
        }
        throw err;
      }
      audit(req, 'user.register', { username }, userId);
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.userId = userId;
        req.session.createdAt = Date.now();
        req.session.lastSeen = Date.now();
        ensureCsrfToken(req);
        res.status(201).json({ user: { id: userId, username, email } });
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/login',
  loginLimiter,
  body('username').isString().trim().isLength({ min: 1, max: 64 }),
  body('password').isString().isLength({ min: 1, max: config.passwordMaxLength }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return genericLoginError(res);

      const { username, password } = req.body;
      const user = findUserByUsername.get(username);

      // Always run a bcrypt comparison to keep timing roughly constant for
      // existing vs non-existing users.
      const dummyHash = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8eJpA0VEvJk2N0z7VqYV4ZQyfZ4Sxi';
      const passwordOk = await verifyPassword(password, user ? user.password_hash : dummyHash);

      if (!user) {
        audit(req, 'login.failure', { username, reason: 'unknown_user' });
        return genericLoginError(res);
      }

      if (user.locked_until && user.locked_until > Date.now()) {
        audit(req, 'login.locked', { username }, user.id);
        return res.status(423).json({ error: 'account_locked' });
      }

      if (!passwordOk) {
        const fails = user.failed_login_count + 1;
        const locked = fails >= config.loginMaxAttempts ? Date.now() + config.loginLockMs : null;
        updateLoginFailure.run(fails, locked, Date.now(), user.id);
        audit(req, 'login.failure', { username, fails, locked: !!locked }, user.id);
        return genericLoginError(res);
      }

      updateLoginSuccess.run(Date.now(), user.id);
      audit(req, 'login.success', null, user.id);

      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.userId = user.id;
        req.session.createdAt = Date.now();
        req.session.lastSeen = Date.now();
        ensureCsrfToken(req);
        res.json({ user: publicUser(user) });
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/logout', (req, res) => {
  const userId = req.session && req.session.userId;
  if (userId) audit(req, 'logout', null, userId);
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ ok: true });
  });
});

module.exports = router;
