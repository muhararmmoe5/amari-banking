import 'server-only';
import crypto from 'crypto';
import { getDb } from './index';
import type { EntityType } from '@/types';

/**
 * Idempotent backfill: ensure every (entity, person) pair with a cash
 * contribution has an active funding_commitment, AND auto-link existing
 * inflow transactions that match the person (by source_person_id,
 * description containing the name, or income_source in known investor
 * codes). Only links transactions that aren't already linked.
 *
 * Safe to call on every page render.
 */
export function ensureCommitmentsForEntity(entity: EntityType): { commitmentsCreated: number; wiresLinked: number } {
  const db = getDb();
  const rows = db.prepare(
    `SELECT entity, person_id, MAX(amount_cents) as total
     FROM cash_contributions WHERE entity = ?
     GROUP BY entity, person_id`
  ).all(entity) as any[];
  let commitmentsCreated = 0;
  let wiresLinked = 0;
  for (const r of rows) {
    let commitmentId: string;
    const existing = db.prepare(
      `SELECT id FROM funding_commitments WHERE entity = ? AND person_id = ? AND status = 'ACTIVE'`
    ).get(r.entity, r.person_id) as any;
    if (existing) {
      commitmentId = existing.id;
    } else {
      commitmentId = crypto.randomUUID();
      const now = Date.now();
      db.prepare(
        `INSERT INTO funding_commitments (id, entity, person_id, total_amount_cents, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`
      ).run(commitmentId, r.entity, r.person_id, r.total, now, now);
      commitmentsCreated += 1;
    }
    const person = db.prepare('SELECT name FROM people WHERE id = ?').get(r.person_id) as any;
    const personName = (person?.name || '').toUpperCase();
    const result = db.prepare(
      `UPDATE transactions
       SET funding_commitment_id = ?, updated_at = ?
       WHERE amount > 0
         AND funding_commitment_id IS NULL
         AND (source_person_id = ?
              OR upper(description) LIKE ?
              OR income_source IN ('SPACETEL', 'OMAR_ALGHAZALI'))`
    ).run(commitmentId, Date.now(), r.person_id, `%${personName}%`);
    wiresLinked += Number(result.changes || 0);
  }
  return { commitmentsCreated, wiresLinked };
}
