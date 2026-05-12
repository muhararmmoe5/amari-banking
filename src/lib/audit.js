'use strict';

const db = require('../db');

const insertStmt = db.prepare(
  `INSERT INTO audit_log (user_id, action, ip, user_agent, details, created_at)
   VALUES (@user_id, @action, @ip, @user_agent, @details, @created_at)`
);

function audit(req, action, details, userIdOverride) {
  try {
    const userId = userIdOverride ?? req?.session?.userId ?? null;
    const ua = (req?.get?.('user-agent') || '').slice(0, 512);
    insertStmt.run({
      user_id: userId,
      action: String(action).slice(0, 64),
      ip: req?.ip ? String(req.ip).slice(0, 64) : null,
      user_agent: ua || null,
      details: details ? JSON.stringify(details).slice(0, 2048) : null,
      created_at: Date.now(),
    });
  } catch (err) {
    // Audit must never crash the request path.
    // eslint-disable-next-line no-console
    console.error('[audit] failed:', err.message);
  }
}

module.exports = { audit };
