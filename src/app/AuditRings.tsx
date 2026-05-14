import type { AuditRings as AuditRingsType } from '@/lib/db/queries';

function Ring({ label, total, reviewed, color }: { label: string; total: number; reviewed: number; color: string }) {
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative w-[72px] h-[72px]">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#1C1C20" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="mono tabnum text-sm font-semibold">{pct}%</div>
        </div>
      </div>
      <div className="text-[11px] text-ink-dim mt-2">{label}</div>
      <div className="text-[10px] text-ink-mute">{reviewed}/{total}</div>
    </div>
  );
}

export default function AuditRings({ data }: { data: AuditRingsType }) {
  return (
    <div className="flex items-center justify-around py-2">
      <Ring label="Wires" total={data.wires.total} reviewed={data.wires.reviewed} color="#F87171" />
      <Ring label="Zelle" total={data.zelle.total} reviewed={data.zelle.reviewed} color="#FB923C" />
      <Ring label="Personal" total={data.personal.total} reviewed={data.personal.reviewed} color="#FCD34D" />
    </div>
  );
}
