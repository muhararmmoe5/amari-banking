import { NextRequest, NextResponse } from 'next/server';
import { fundedByInflow, expensesFundedByInflow } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Returns either:
 *   - the manually-linked inflow for an expense (when ?txId=<expense>), OR
 *   - the list of expenses manually linked to an inflow (when ?inflowId=<inflow>)
 *  No FIFO. Only what the user has explicitly tagged.
 */
export async function GET(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.role !== 'OWNER') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const txId = sp.get('txId');
  const inflowId = sp.get('inflowId');
  if (txId) {
    return NextResponse.json({ fundedBy: fundedByInflow(txId) });
  }
  if (inflowId) {
    return NextResponse.json({ expenses: expensesFundedByInflow(inflowId) });
  }
  return NextResponse.json({ error: 'txId or inflowId required' }, { status: 400 });
}
