import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Lightweight search endpoint for picking transactions inline (e.g. linking a
 *  cash contribution to a wire). Returns top N matching recent rows.  */
export async function GET(req: NextRequest) {
  const u = getCurrentUser();
  if (!u || !hasEditAccess(u)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const inflowOnly = sp.get('inflowOnly') === '1';
  const limit = Math.min(Number(sp.get('limit') || '20'), 100);
  const db = getDb();

  const where: string[] = [];
  const params: any[] = [];
  if (inflowOnly) where.push('amount > 0');
  if (q) {
    where.push('(merchant_name LIKE ? OR description LIKE ? OR id LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const sql = `
    SELECT id, posting_date, description, merchant_name, amount, account_id
    FROM transactions
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY posting_date DESC
    LIMIT ?
  `;
  params.push(limit);
  const rows = db.prepare(sql).all(...params) as any[];
  return NextResponse.json({
    transactions: rows.map((r) => ({
      id: r.id,
      postingDate: r.posting_date,
      description: r.description,
      merchant: r.merchant_name,
      amount: r.amount,
      accountId: r.account_id,
    })),
  });
}
