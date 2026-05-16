import { NextRequest, NextResponse } from 'next/server';
import { traceFundingSource } from '@/lib/db/flow-trace';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const txId = url.searchParams.get('txId');
  if (!txId) return NextResponse.json({ error: 'txId required' }, { status: 400 });
  const result = traceFundingSource(txId);
  if (!result) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(result);
}
