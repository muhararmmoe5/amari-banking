'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const config = require('./config');
require('./db');

const { csrfProtect } = require('./middleware/csrf');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/accounts');
const txRoutes = require('./routes/transactions');

const app = express();

app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: config.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  })
);

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

const sessionDir = path.dirname(path.resolve(config.dbPath));
app.use(
  session({
    name: 'sid',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.isProd,
      maxAge: config.sessionAbsoluteMs,
    },
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: sessionDir, concurrentDB: true }),
  })
);

app.use(csrfProtect);

app.use('/api/auth', authRoutes);
app.use('/api/accounts', requireAuth, accountRoutes);
app.use('/api/transactions', requireAuth, txRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    fallthrough: true,
    index: ['index.html'],
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`amari-banking listening on http://127.0.0.1:${config.port}`);
  });
}

module.exports = app;
