import { NextRequest, NextResponse } from 'next/server';
import { getAccountDayActivity } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const account = url.searchParams.get('account');
  const date = url.searchParams.get('date');
  if (!account || !date) {
    return NextResponse.json({ error: 'account and date required' }, { status: 400 });
  }
  if (!/^[\d]{1,8}$/.test(account)) {
    return NextResponse.json({ error: 'invalid account' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }
  const rows = getAccountDayActivity(account, date);
  return NextResponse.json({ rows });
}
