#!/usr/bin/env node
/**
 * One-off: create an invite for hamzah@amariventure.com and print the URL.
 * Reuses createPerson() and createInvite() — no new hashing/token logic.
 *
 * Run with:
 *   npx tsx scripts/create-invite.mjs
 *
 * Optional:
 *   BASE_URL=https://your-app.up.railway.app npx tsx scripts/create-invite.mjs
 *   ROLE=OWNER npx tsx scripts/create-invite.mjs   (defaults to PARTNER)
 */

import { createInvite } from '../src/lib/auth/sessions.ts';
import { createPerson, listPeople } from '../src/lib/db/cap.ts';

const EMAIL = 'hamzah@amariventure.com';
const ROLE = process.env.ROLE || 'PARTNER';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Reuse an existing person with this email if one exists; otherwise create one.
const existing = listPeople().find(
  (p) => p.email && p.email.toLowerCase() === EMAIL.toLowerCase(),
);
const person = existing || createPerson({
  name: 'Hamzah',
  email: EMAIL,
  role: 'PARTNER',
  notes: 'Invited via one-off script',
});

// createdByUserId = null — this is a script, not an OWNER session.
const invite = createInvite(person.id, EMAIL, ROLE, null);

const url = `${BASE_URL.replace(/\/$/, '')}/invite/${invite.token}`;
const expires = new Date(invite.expiresAt).toISOString();

console.log(`\n✓ invite created for ${EMAIL}`);
console.log(`  person:  ${person.name} (${person.id})${existing ? ' [reused]' : ' [new]'}`);
console.log(`  role:    ${ROLE}`);
console.log(`  expires: ${expires}`);
console.log(`\n${url}\n`);
