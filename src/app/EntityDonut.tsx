'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { EntityType } from '@/types';
import { ENTITY_COLORS, ENTITY_LABELS } from '@/constants/accounts';

export default function EntityDonut({ data }: { data: { entity: EntityType; income: number }[] }) {
  const filtered = data.filter((d) => d.income > 0);
  if (filtered.length === 0) {
    return <div className="text-sm text-ink-mute py-12 text-center">No income to chart yet.</div>;
  }
  const total = filtered.reduce((s, d) => s + d.income, 0);
  return (
    <div className="h-52 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="income"
            nameKey="entity"
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={78}
            paddingAngle={1.5}
            stroke="#0C0C0E"
            strokeWidth={2}
          >
            {filtered.map((d) => (
              <Cell key={d.entity} fill={ENTITY_COLORS[d.entity]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#141417', border: '1px solid #26262C', borderRadius: 8, fontSize: 12 }}
            formatter={(v: number, name: string) => [
              `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              ENTITY_LABELS[name as EntityType] || name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-[10px] uppercase tracking-wider text-ink-mute">Revenue</div>
        <div className="mono tabnum text-base font-semibold">
          ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </div>
      </div>
    </div>
  );
}
