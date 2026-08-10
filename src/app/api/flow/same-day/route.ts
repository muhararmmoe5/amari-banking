import { NextRequest, NextResponse } from 'next/server';
import { getSameDayTransactions } from '@/lib/db/flow-trace';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || !hasEditAccess(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const txId = url.searchParams.get('txId');
  if (!txId) return NextResponse.json({ error: 'txId required' }, { status: 400 });
  const rows = getSameDayTransactions(txId);
  return NextResponse.json({ rows });
}
