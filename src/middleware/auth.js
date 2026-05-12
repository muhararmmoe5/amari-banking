'use strict';

const config = require('../config');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'authentication_required' });
  }
  const now = Date.now();
  if (req.session.lastSeen && now - req.session.lastSeen > config.sessionIdleMs) {
    return req.session.destroy(() => {
      res.clearCookie('sid');
      res.status(401).json({ error: 'session_expired' });
    });
  }
  if (req.session.createdAt && now - req.session.createdAt > config.sessionAbsoluteMs) {
    return req.session.destroy(() => {
      res.clearCookie('sid');
      res.status(401).json({ error: 'session_expired' });
    });
  }
  req.session.lastSeen = now;
  next();
}

module.exports = { requireAuth };
