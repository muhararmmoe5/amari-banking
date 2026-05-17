import { entityPLs } from '@/lib/db/queries';
import { ENTITY_LABELS, ENTITY_COLORS } from '@/constants/accounts';
import { fmtMoney } from '@/lib/format';
import { Money } from '@/components/Money';

export const dynamic = 'force-dynamic';

export default function PLPage() {
  const data = entityPLs();
  const order = ['BYTES_AI', 'ROCKET_WIRELESS', 'DELICIOUS_BYTES', 'AMARI_VENTURES', 'BYTES_REST_TECH', 'PERSONAL', 'BUSINESS_SHARED', 'MULTI_ENTITY', 'UNKNOWN'];
  const sorted = [...data].sort((a, b) => order.indexOf(a.entity) - order.indexOf(b.entity));

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Entity P&L</h1>
        <p className="text-sm text-ink-dim mt-1">Income, expenses, and net per business entity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((e) => (
          <div key={e.entity} className="card p-5">
            <div className="h-1 -m-5 mb-4 rounded-t-xl" style={{ background: ENTITY_COLORS[e.entity] }} />
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{ENTITY_LABELS[e.entity]}</h3>
              <span className={`mono tabnum text-lg ${e.net >= 0 ? 'text-income' : 'text-expense'}`}>{fmtMoney(e.net)}</span>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <Line label="Revenue" value={e.income} positive />
              <Line label="Total expenses" value={-e.expenses} />
            </div>
            {(e.passthroughOut > 0 || e.passthroughIn > 0) ? (
              <div className="mt-3 pt-3 border-t border-line space-y-1 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-ink-mute">Passthroughs · sub-tag</div>
                {e.passthroughOut > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-ink-dim">↗ Booked here but redirected to other entities</span>
                    <span className="mono text-warn">−{fmtMoney(e.passthroughOut)}</span>
                  </div>
                ) : null}
                {e.passthroughIn > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-ink-dim">↘ Funded by other entities&apos; books but bears this entity</span>
                    <span className="mono text-warn">+{fmtMoney(e.passthroughIn)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-1 border-t border-line/40">
                  <span className="text-ink">Adjusted net (passthrough-aware)</span>
                  <span className={`mono tabnum ${(e.net + e.passthroughOut - e.passthroughIn) >= 0 ? 'text-income' : 'text-expense'}`}>
                    {fmtMoney(e.net + e.passthroughOut - e.passthroughIn)}
                  </span>
                </div>
              </div>
            ) : null}
            <div className="mt-4 pt-3 border-t border-line">
              <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-2">Top expense categories</div>
              <div className="space-y-1">
                {e.topExpenseCategories.length === 0 ? (
                  <div className="text-xs text-ink-mute">None</div>
                ) : e.topExpenseCategories.map((c) => (
                  <div key={c.category} className="flex justify-between text-xs">
                    <span className="text-ink-dim truncate">{c.category.replace(/^(EXPENSE_|INCOME_)/, '').replace(/_/g, ' ')}</span>
                    <span className="mono text-expense">{fmtMoney(c.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Line({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-dim">{label}</span>
      <Money value={positive ? Math.abs(value) : value} />
    </div>
  );
}
