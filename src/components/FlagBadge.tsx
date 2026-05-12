import { flagSeverity } from '@/lib/format';

export function FlagBadge({ score }: { score: number }) {
  const s = flagSeverity(score);
  if (s === 'ok') return null;
  const map = {
    crit: { bg: 'bg-flag-critBg', text: 'text-flag-critText', label: 'Critical', icon: '🔴' },
    high: { bg: 'bg-flag-highBg', text: 'text-flag-highText', label: 'High', icon: '🟠' },
    med: { bg: 'bg-flag-medBg', text: 'text-flag-medText', label: 'Medium', icon: '🟡' },
    low: { bg: 'bg-bg-2', text: 'text-ink-dim', label: 'Low', icon: '⚪' },
  } as const;
  const m = map[s as keyof typeof map];
  return (
    <span className={`pill ${m.bg} ${m.text}`}>
      <span className="mr-1">{m.icon}</span>
      {m.label} · {score}
    </span>
  );
}
