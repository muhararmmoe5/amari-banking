import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';
import { listInflowsOnAccount } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || !hasEditAccess(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const accountId = req.nextUrl.searchParams.get('accountId');
  if (!accountId) return NextResponse.json({ inflows: [] });
  const inflows = listInflowsOnAccount(accountId, 50);
  return NextResponse.json({ inflows });
}
