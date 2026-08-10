import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';
import { clearAllTransactions } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

/**
 * Wipes all imported transactions and their derived rows. Requires the
 * caller to be signed in with edit access AND to send an exact confirmation
 * phrase in the body — this is destructive and irreversible, so a plain
 * OWNER-check isn't enough friction on its own.
 *
 * Body: { confirm: string }   // must equal 'clear my transactions'
 */
export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || !hasEditAccess(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* fall through */ }

  if (body.confirm !== 'clear my transactions') {
    return NextResponse.json(
      { error: 'confirmation phrase required', hint: 'send { confirm: "delete everything" }' },
      { status: 400 },
    );
  }

  const result = clearAllTransactions();

  revalidatePath('/');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  revalidatePath('/audit');
  revalidatePath('/import');

  return NextResponse.json({ ok: true, ...result });
}
