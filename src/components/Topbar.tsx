'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Download } from 'lucide-react';

const MONTHS = [
  { v: '01', label: 'Jan' },
  { v: '02', label: 'Feb' },
  { v: '03', label: 'Mar' },
  { v: '04', label: 'Apr' },
  { v: '05', label: 'May' },
  { v: '06', label: 'Jun' },
  { v: '07', label: 'Jul' },
  { v: '08', label: 'Aug' },
  { v: '09', label: 'Sep' },
  { v: '10', label: 'Oct' },
  { v: '11', label: 'Nov' },
  { v: '12', label: 'Dec' },
];

export default function Topbar({ title }: { title: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const period = params.get('period') || 'ytd';

  const set = (next: string) => {
    const sp = new URLSearchParams(params.toString());
    if (next === 'ytd') sp.delete('period');
    else sp.set('period', next);
    router.push('?' + sp.toString());
  };

  return (
    <div className="border-b border-line surface-glass sticky top-0 z-20">
      <div className="max-w-[1320px] mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-0.5 bg-bg-2/70 border border-line rounded-full p-1 text-xs">
            {MONTHS.slice(0, 6).map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => set(m.v)}
                className={`px-3 py-1 rounded-full transition font-medium ${
                  period === m.v ? 'bg-bg-0 text-ink shadow-elev-1' : 'text-ink-mute hover:text-ink'
                }`}
              >
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => set('ytd')}
              className={`px-3 py-1 rounded-full transition font-medium ${
                period === 'ytd' ? 'bg-bg-0 text-ink shadow-elev-1' : 'text-ink-mute hover:text-ink'
              }`}
            >
              YTD
            </button>
          </div>
          <Link href="/import" className="btn btn-primary text-sm">
            <Upload size={14} strokeWidth={2.25} />
            Import CSV
          </Link>
          <Link href="/cpa" className="btn text-sm">
            <Download size={14} strokeWidth={2.25} />
            Export CPA
          </Link>
        </div>
      </div>
    </div>
  );
}

