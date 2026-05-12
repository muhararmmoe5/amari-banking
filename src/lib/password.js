'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config');

function validatePasswordPolicy(password) {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < config.passwordMinLength) {
    return `Password must be at least ${config.passwordMinLength} characters`;
  }
  if (password.length > config.passwordMaxLength) {
    return `Password must be at most ${config.passwordMaxLength} characters`;
  }
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (classes < 3) {
    return 'Password must contain at least 3 of: lowercase, uppercase, digit, symbol';
  }
  return null;
}

async function hashPassword(password) {
  return bcrypt.hash(password, config.bcryptRounds);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

module.exports = { validatePasswordPolicy, hashPassword, verifyPassword };
