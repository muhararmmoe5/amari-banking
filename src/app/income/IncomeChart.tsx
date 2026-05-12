'use client';

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { IncomeTimePoint } from '@/lib/db/queries';

const SOURCE_COLORS: Record<string, string> = {
  SPACETEL: '#C060F0',
  OMAR_ALGHAZALI: '#9F40D8',
  TCETRA: '#60C8F0',
  VIDAPAY: '#40A8D0',
  STRIPE: '#C8F060',
  DOORDASH: '#F0A060',
  GRUBHUB: '#F08060',
  UBER_EATS: '#F0D060',
  GUSTO: '#A0D840',
  ZELLE_IN: '#7c3aed',
  WIRE_UNKNOWN: '#888888',
  OTHER: '#666666',
};

const SOURCE_LABELS: Record<string, string> = {
  SPACETEL: 'Spacetel',
  OMAR_ALGHAZALI: 'Omar Alghazali',
  TCETRA: 'TCETRA',
  VIDAPAY: 'Vidapay',
  STRIPE: 'Stripe',
  DOORDASH: 'DoorDash',
  GRUBHUB: 'Grubhub',
  UBER_EATS: 'Uber Eats',
  GUSTO: 'Gusto',
  ZELLE_IN: 'Zelle inbound',
  WIRE_UNKNOWN: 'Unknown wires',
  OTHER: 'Other',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toFixed(0)}`;
}

export default function IncomeChart({ points, sources }: { points: IncomeTimePoint[]; sources: string[] }) {
  if (points.length === 0) {
    return <div className="text-ink-mute text-sm">Not enough data for a chart yet. Import more months.</div>;
  }
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            {sources.map((s) => (
              <linearGradient key={s} id={`grad-${s}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SOURCE_COLORS[s] || '#888'} stopOpacity={0.5} />
                <stop offset="95%" stopColor={SOURCE_COLORS[s] || '#888'} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#26262C" />
          <XAxis dataKey="month" stroke="#6B6B66" fontSize={11} tickMargin={6} />
          <YAxis stroke="#6B6B66" fontSize={11} tickFormatter={fmt} width={50} />
          <Tooltip
            contentStyle={{ background: '#141417', border: '1px solid #26262C', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#A8A8A0' }}
            formatter={(v: number, name: string) => [fmt(v), SOURCE_LABELS[name] || name]}
          />
          <Legend
            formatter={(v) => <span className="text-xs text-ink-dim">{SOURCE_LABELS[v] || v}</span>}
            iconSize={10}
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          />
          {sources.map((s) => (
            <Area
              key={s}
              type="monotone"
              dataKey={s}
              stackId="1"
              stroke={SOURCE_COLORS[s] || '#888'}
              fill={`url(#grad-${s})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
