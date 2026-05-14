import { NextRequest, NextResponse } from 'next/server';
import { getStoredCsv } from '@/lib/ai/tools';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const stored = getStoredCsv(params.id);
  if (!stored) {
    return NextResponse.json({ error: 'not_found_or_expired' }, { status: 404 });
  }
  // Prepend a UTF-8 BOM so Excel opens it cleanly
  const body = '﻿' + stored.csv;
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${stored.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
