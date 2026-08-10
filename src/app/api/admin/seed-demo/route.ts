import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * Manual trigger for the demo-data seed. OWNER-only. Lets you populate a
 * fresh deploy with sample transactions even if SEED_DEMO_DATA env var isn't
 * set. The seed itself is idempotent — it bails if the table already has
 * rows — so calling this twice does nothing the second time.
 */
export async function POST() {
  const user = getCurrentUser();
  if (!user || !hasEditAccess(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const existing = (db.prepare('SELECT COUNT(*) AS c FROM transactions').get() as { c: number }).c;
  if (existing > 0) {
    return NextResponse.json({
      ok: false,
      message: `Skipped — transactions table already has ${existing} rows`,
      existing,
    });
  }

  // Temporarily force the seed regardless of env var.
  const prev = process.env.SEED_DEMO_DATA;
  process.env.SEED_DEMO_DATA = 'true';
  let result: { inserted: number; skipped: boolean } = { inserted: 0, skipped: true };
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { seedDemoIfEmpty } = require('@/lib/db/seed-demo');
    result = seedDemoIfEmpty(db);
  } finally {
    if (prev === undefined) delete process.env.SEED_DEMO_DATA;
    else process.env.SEED_DEMO_DATA = prev;
  }

  revalidatePath('/transactions');
  revalidatePath('/dashboard');

  return NextResponse.json({ ok: true, inserted: result.inserted });
}
