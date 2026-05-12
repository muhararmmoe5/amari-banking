'use strict';

const config = require('../config');

function notFound(req, res) {
  res.status(404).json({ error: 'not_found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('[error]', err && err.stack ? err.stack : err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error: 'internal_server_error',
    ...(config.isProd ? {} : { message: err.message }),
  });
}

module.exports = { notFound, errorHandler };
