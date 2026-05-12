import { NextRequest, NextResponse } from 'next/server';
import { generateCpaWorkbook } from '@/lib/exporters/cpa-excel';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateFrom = url.searchParams.get('from') || undefined;
  const dateTo = url.searchParams.get('to') || undefined;
  const buf = generateCpaWorkbook({ dateFrom, dateTo });
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Moe_CPA_Package_${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
