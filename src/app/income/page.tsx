import { getDb } from '@/lib/db';
import { incomeBySources, listTransactions, incomeByMonthAndSource } from '@/lib/db/queries';
import { Money } from '@/components/Money';
import { fmtMoney, fmtDate } from '@/lib/format';
import IncomeChart from './IncomeChart';

export const dynamic = 'force-dynamic';

const SOURCE_LABELS: Record<string, string> = {
  SPACETEL: 'Spacetel',
  OMAR_ALGHAZALI: 'Omar Alghazali (Spacetel?)',
  TCETRA: 'TCETRA',
  VIDAPAY: 'Vidapay',
  STRIPE: 'Stripe',
  DOORDASH: 'DoorDash',
  GRUBHUB: 'Grubhub',
  UBER_EATS: 'Uber Eats',
  GUSTO: 'Gusto refund',
  ZELLE_IN: 'Zelle inbound',
  WIRE_UNKNOWN: 'Unknown wires',
  OTHER: 'Other',
};

export default function IncomePage() {
  const db = getDb();
  const sources = incomeBySources();
  const timeSeries = incomeByMonthAndSource();
  const spacetelReceipts = listTransactions({
    limit: 100,
    orderBy: 'posting_date',
  }).filter((t) => t.incomeSource === 'SPACETEL' || t.incomeSource === 'OMAR_ALGHAZALI');

  // for each spacetel receipt, find same-day outflows in same account
  const sameDay = db.prepare(`
    SELECT id, account_id, posting_date, description, amount, is_internal, merchant_name
    FROM transactions
    WHERE account_id = ? AND posting_date = ? AND amount < 0
    ORDER BY ABS(amount) DESC
  `);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Income tracker</h1>
        <p className="text-sm text-ink-dim mt-1">Where money comes from, by source and over time.</p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm uppercase tracking-wider text-ink-dim mb-4">Income over time</h2>
        <IncomeChart points={timeSeries.points} sources={timeSeries.sources} />
      </div>

      <div className="card p-5">
        <h2 className="text-sm uppercase tracking-wider text-ink-dim mb-4">By source</h2>
        {sources.length === 0 ? (
          <p className="text-ink-mute text-sm">No income recorded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sources.map((s) => (
              <div key={s.source} className="rounded-lg border border-line p-4">
                <div className="text-xs uppercase tracking-wider text-ink-mute">{SOURCE_LABELS[s.source] || s.source}</div>
                <div className="mono tabnum text-2xl text-income mt-1">{fmtMoney(s.total)}</div>
                <div className="text-xs text-ink-mute mt-1">{s.count} receipts</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm uppercase tracking-wider text-ink-dim mb-4">Spacetel flow</h2>
        {spacetelReceipts.length === 0 ? (
          <p className="text-ink-mute text-sm">No Spacetel wires recorded.</p>
        ) : (
          <div className="space-y-4">
            {spacetelReceipts.map((r) => {
              const outflows = sameDay.all(r.accountId, r.postingDate) as any[];
              return (
                <div key={r.id} className="border-l-2 border-entity-bytes pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{r.merchantName}</div>
                      <div className="text-xs text-ink-mute mono">···{r.accountId} · {fmtDate(r.postingDate)}</div>
                    </div>
                    <Money value={r.amount} className="text-lg" />
                  </div>
                  {outflows.length > 0 ? (
                    <div className="mt-3 ml-4 space-y-1">
                      <div className="text-xs text-ink-mute uppercase tracking-wider">Same-day outflows ({outflows.length})</div>
                      {outflows.map((o) => (
                        <div key={o.id} className="flex justify-between text-xs">
                          <span className="truncate max-w-[420px] text-ink-dim">
                            {o.is_internal ? '↻ ' : ''}{o.merchant_name || o.description}
                          </span>
                          <span className="mono text-expense">{fmtMoney(o.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
