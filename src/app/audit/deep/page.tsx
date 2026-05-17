import 'server-only';
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { traceAllExpensesOnAccount } from '@/lib/db/flow-trace';
import { ACCOUNTS, getAccount } from '@/constants/accounts';
import { fmtMoney, fmtDate, fmtDateShort } from '@/lib/format';
import { SOURCE_LABEL } from '@/lib/source-labels';

export const dynamic = 'force-dynamic';

interface Search {
  account?: string;
  from?: string;
  to?: string;
  hideInternal?: string;
  minAmount?: string;
  limit?: string;
}

export default function DeepAuditPage({ searchParams }: { searchParams: Search }) {
  const accountId = searchParams.account || '';
  const hideInternal = searchParams.hideInternal !== '0';
  const dateFrom = searchParams.from || '';
  const dateTo = searchParams.to || '';
  const minAmount = Number(searchParams.minAmount || '0') || 0;
  const limit = Math.min(Number(searchParams.limit || '500') || 500, 5000);

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deep source audit</h1>
          <p className="text-sm text-ink-dim mt-1">
            Pre-computed FIFO source trace for every expense on a single account. One pass, no per-row clicks.
          </p>
        </div>
        <Link href="/transactions" className="btn">← All transactions</Link>
      </div>

      <form className="card p-4 text-xs flex flex-wrap gap-3 items-end" method="GET">
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Account *</div>
          <select name="account" defaultValue={accountId} className="min-w-[280px]">
            <option value="">— pick one —</option>
            {ACCOUNTS.map((a) => (
              <option key={a.id} value={a.id}>···{a.last4} — {a.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">From</div>
          <input name="from" type="date" defaultValue={dateFrom} />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">To</div>
          <input name="to" type="date" defaultValue={dateTo} />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Min |amount|</div>
          <input name="minAmount" type="number" step="1" defaultValue={String(minAmount || '')} className="w-24" />
        </label>
        <label className="block">
          <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Show</div>
          <input name="limit" type="number" step="50" defaultValue={String(limit)} className="w-24" />
        </label>
        <label className="inline-flex items-center gap-1 text-ink-dim">
          <input type="checkbox" name="hideInternal" value="0" defaultChecked={!hideInternal} className="accent-entity-bytes" />
          Show internal transfers
        </label>
        <button type="submit" className="btn btn-primary">Run audit</button>
      </form>

      {accountId ? <DeepAuditBody {...{ accountId, dateFrom, dateTo, hideInternal, minAmount, limit }} /> : (
        <div className="card p-6 text-sm text-ink-dim">
          Pick an account to run the trace. The whole account history is replayed in chronological order so every expense gets a pre-computed source — no clicking.
        </div>
      )}
    </div>
  );
}

function DeepAuditBody({
  accountId, dateFrom, dateTo, hideInternal, minAmount, limit,
}: {
  accountId: string; dateFrom: string; dateTo: string; hideInternal: boolean; minAmount: number; limit: number;
}) {
  const db = getDb();
  const acct = getAccount(accountId);

  const traces = traceAllExpensesOnAccount(accountId);

  const clauses: string[] = ['account_id = ?', 'amount < 0'];
  const args: any[] = [accountId];
  if (hideInternal) clauses.push('is_internal = 0');
  if (dateFrom) { clauses.push('posting_date >= ?'); args.push(dateFrom); }
  if (dateTo) { clauses.push('posting_date <= ?'); args.push(dateTo); }
  if (minAmount > 0) { clauses.push('ABS(amount) >= ?'); args.push(minAmount); }

  const rows = db.prepare(`
    SELECT id, posting_date, transaction_date, description, merchant_name, amount, balance,
      is_internal, confirmed_entity, entity_tag, category, sub_category_1
    FROM transactions
    WHERE ${clauses.join(' AND ')}
    ORDER BY posting_date DESC, id DESC
    LIMIT ?
  `).all(...args, limit) as any[];

  const totalOut = rows.reduce((s, r) => s + Math.abs(r.amount), 0);
  let tracedSum = 0;
  let uncoveredSum = 0;
  for (const r of rows) {
    const t = traces.get(r.id);
    if (t) {
      tracedSum += t.totalAttributed;
      uncoveredSum += t.uncovered;
    } else {
      uncoveredSum += Math.abs(r.amount);
    }
  }

  return (
    <>
      <div className="card p-4 flex flex-wrap gap-6 text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-mute">Account</div>
          <div className="font-medium">···{acct?.last4} — {acct?.label || accountId}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-mute">Expenses shown</div>
          <div className="font-medium">{rows.length.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-mute">Total out</div>
          <div className="mono tabnum text-expense">{fmtMoney(totalOut)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-mute">Traced to inflow</div>
          <div className="mono tabnum text-income">{fmtMoney(tracedSum)}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-ink-mute">Untraced (pre-import)</div>
          <div className="mono tabnum text-warn">{fmtMoney(uncoveredSum)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="card p-6 text-sm text-ink-dim">No expenses match these filters.</div>
        ) : rows.map((r) => {
          const t = traces.get(r.id);
          const sources = t?.sources || [];
          const uncovered = t?.uncovered ?? Math.abs(r.amount);
          const attributed = t?.totalAttributed ?? 0;
          const absAmt = Math.abs(r.amount);
          return (
            <div key={r.id} className="card overflow-hidden">
              <div className="p-3 border-b border-line/60 flex items-center justify-between bg-bg-2/30">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {r.merchant_name || r.description.slice(0, 100)}
                    {r.is_internal ? (
                      <span className="ml-2 pill text-[10px] bg-warn/10 text-warn border border-warn/30">internal</span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-ink-mute truncate">{r.description}</div>
                  <div className="text-[11px] text-ink-mute mt-1 flex flex-wrap gap-2">
                    <span>📅 posted {fmtDateShort(r.posting_date)}</span>
                    {r.transaction_date && r.transaction_date !== r.posting_date ? (
                      <span>· charged {fmtDateShort(r.transaction_date)}</span>
                    ) : null}
                    {r.sub_category_1 ? <span>· {r.sub_category_1}</span> : null}
                    {r.balance != null ? (
                      <span>· bal after <span className={r.balance < 0 ? 'text-expense' : 'text-ink-dim'}>{fmtMoney(r.balance)}</span></span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="mono tabnum text-expense">{fmtMoney(r.amount)}</div>
                  <div className="text-[10px] text-ink-mute">
                    {attributed > 0 ? `${((attributed / absAmt) * 100).toFixed(0)}% traced` : '0% traced'}
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-2">
                {sources.length > 0 ? (
                  <div className="divide-y divide-line/60 -mx-3">
                    {sources.map((s, i) => {
                      const counter = s.counterpartyAccountId ? getAccount(s.counterpartyAccountId) : null;
                      const pct = (s.amount / absAmt) * 100;
                      return (
                        <div key={`${s.txId}-${i}`} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm truncate">
                                <ArrowFrom /> {s.merchant || s.description.slice(0, 80)}
                                {s.incomeSource ? (
                                  <span className="ml-2 pill text-[10px] bg-income/10 text-income border border-income/30">
                                    {SOURCE_LABEL[s.incomeSource] || s.incomeSource}
                                  </span>
                                ) : null}
                                {s.isInternal ? (
                                  <span className="ml-2 pill text-[10px] bg-warn/10 text-warn border border-warn/30">
                                    ⇄ from ···{s.counterpartyAccountId}{counter ? ` (${counter.label})` : ''}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-ink-mute">
                                {fmtDate(s.date)} · originally {fmtMoney(s.totalInflow)}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="mono tabnum text-income">{fmtMoney(s.amount)}</div>
                              <div className="text-[10px] text-ink-mute">{pct.toFixed(1)}%</div>
                            </div>
                          </div>
                          <div className="h-1 bg-bg-2 rounded mt-1.5 overflow-hidden">
                            <div className="h-full bg-income" style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-ink-mute italic">No prior inflow on this account to attribute against.</div>
                )}
                {uncovered > 0.01 ? (
                  <div className="text-[11px] text-warn">
                    ⚠ Untraced: {fmtMoney(uncovered)} — likely from a pre-import balance on this account.
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ArrowFrom() {
  return <span className="text-income mr-1">←</span>;
}
