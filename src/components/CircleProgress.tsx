/**
 * SVG ring progress indicator.
 * Renders a track + foreground stroke with rounded caps, rotated -90deg so 12-o'clock is the start.
 */
export function CircleProgress({
  pct,
  size = 64,
  color = 'var(--color-accent, #c9a87a)',
  trackColor = 'var(--color-bg-3, #1c1c21)',
  stroke = 5,
}: {
  pct: number;
  size?: number;
  color?: string;
  trackColor?: string;
  stroke?: number;
}) {
  const r = (size - stroke - 3) / 2;
  const C = 2 * Math.PI * r;
  const dash = C * Math.max(0, Math.min(1, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C - dash}`}
      />
    </svg>
  );
}
