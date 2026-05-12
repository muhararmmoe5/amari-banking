'use strict';

require('dotenv').config();
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProd) {
    throw new Error('SESSION_SECRET is required in production');
  }
  sessionSecret = crypto.randomBytes(48).toString('hex');
  // eslint-disable-next-line no-console
  console.warn('[config] SESSION_SECRET not set — using an ephemeral dev secret. Sessions reset on restart.');
}
if (sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters');
}

module.exports = {
  isProd,
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || './data/bank.db',
  sessionSecret,
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  trustProxy: process.env.TRUST_PROXY === 'true',

  sessionAbsoluteMs: 1000 * 60 * 60 * 8,
  sessionIdleMs: 1000 * 60 * 15,

  loginMaxAttempts: 5,
  loginLockMs: 1000 * 60 * 15,

  passwordMinLength: 12,
  passwordMaxLength: 128,

  transferMaxCents: 1_000_000_00,
};
