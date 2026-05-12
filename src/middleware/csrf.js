'use strict';

const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureCsrfToken(req) {
  if (!req.session) return null;
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function csrfProtect(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const sessionToken = req.session && req.session.csrfToken;
  const provided = req.get('X-CSRF-Token') || (req.body && req.body._csrf);
  if (!sessionToken || !provided || !safeEqual(sessionToken, provided)) {
    return res.status(403).json({ error: 'invalid_csrf_token' });
  }
  next();
}

module.exports = { csrfProtect, ensureCsrfToken };
