#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'amari.db');
const targets = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];

let removed = 0;
for (const file of targets) {
  if (fs.existsSync(file)) {
    fs.rmSync(file, { force: true });
    console.log(`removed ${path.relative(process.cwd(), file)}`);
    removed++;
  }
}

if (removed === 0) {
  console.log(`no database files found at ${path.relative(process.cwd(), dbPath)} — nothing to remove`);
} else {
  console.log(`\ndatabase wiped. on next \`npm run dev\` the schema will be rebuilt and accounts re-seeded.`);
}
