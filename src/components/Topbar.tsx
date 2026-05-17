'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Sparkles, Bell, HelpCircle, Calendar, ChevronDown, Upload, Download, Tag } from 'lucide-react';

const PERIOD_OPTS = [
  { v: '', l: 'All time' },
  { v: '7d', l: 'Last 7d' },
  { v: '30d', l: 'Last 30d' },
  { v: 'mtd', l: 'Month-to-date' },
  { v: 'last_month', l: 'Last month' },
  { v: 'qtd', l: 'Quarter-to-date' },
  { v: 'ytd', l: 'Year-to-date' },
  { v: 'last_year', l: 'Last year' },
];

export default function Topbar({ title: _title }: { title?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const period = params.get('period') || '';
  const currentLabel = PERIOD_OPTS.find((p) => p.v === period)?.l || 'All time';

  function setPeriod(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (!next) sp.delete('period');
    else sp.set('period', next);
    router.push('?' + sp.toString());
  }

  return (
    <div className="h-14 flex-none border-b border-line surface-glass flex items-center px-6 gap-3.5 sticky top-0 z-20">
      {/* Entity scope (placeholder — wire to real switcher later) */}
      <button
        type="button"
        className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-md bg-bg-2 border border-line hover:bg-bg-3 hover:border-line-strong transition"
        title="Scope: all entities"
      >
        <div
          className="w-[22px] h-[22px] rounded-md grid place-items-center text-bg-0 font-bold text-[10.5px]"
          style={{ background: 'linear-gradient(135deg, #c9a87a 0%, #6b8aa8 50%, #c98a7a 100%)' }}
        >
          A
        </div>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[12.5px] font-medium">All entities</span>
          <span className="text-[10.5px] text-ink-mute">5 entities · 15 accounts</span>
        </div>
        <ChevronDown size={12} className="text-ink-mute ml-1" />
      </button>

      {/* Period selector */}
      <div className="relative">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="!appearance-none !pl-9 !pr-8 !py-1.5 !rounded-md !bg-bg-2 !border !border-line hover:!bg-bg-3 hover:!border-line-strong !text-[12.5px] !font-medium cursor-pointer h-[32px]"
        >
          {PERIOD_OPTS.map((p) => (
            <option key={p.v || 'all'} value={p.v}>{p.l}</option>
          ))}
        </select>
        <Calendar size={14} className="text-ink-dim absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="flex items-center gap-2 bg-bg-2 border border-line px-3 py-1.5 rounded-md text-ink-mute min-w-[280px] focus-within:border-line-2 transition">
        <Search size={13} />
        <input className="flex-1 !bg-transparent !border-0 !p-0 !text-[12.5px] !text-ink !rounded-none focus:!shadow-none placeholder:text-ink-mute" placeholder="Search transactions, merchants, accounts…" />
        <kbd>⌘K</kbd>
      </div>

      <Link href="/import" className="btn btn-sm" title="Import CSV">
        <Upload size={13} />
        <span className="hidden lg:inline">Import</span>
      </Link>
      <Link href="/cpa" className="btn btn-sm" title="CPA Export">
        <Download size={13} />
        <span className="hidden lg:inline">Export</span>
      </Link>
      <Link href="/audit" className="btn btn-primary btn-sm" title="Tag transactions">
        <Tag size={13} />
        <span className="hidden lg:inline">Tag</span>
      </Link>

      <button className="w-8 h-8 grid place-items-center rounded-md text-ink-dim hover:bg-bg-2 hover:text-ink transition" title="AI assistant">
        <Sparkles size={15} className="text-accent" style={{ color: '#c9a87a' }} />
      </button>
      <button className="w-8 h-8 grid place-items-center rounded-md text-ink-dim hover:bg-bg-2 hover:text-ink transition relative" title="Notifications">
        <Bell size={15} />
        <span className="absolute top-[7px] right-[7px] w-1.5 h-1.5 rounded-full" style={{ background: '#c9a87a', boxShadow: '0 0 0 2px #111114' }} />
      </button>
      <button className="w-8 h-8 grid place-items-center rounded-md text-ink-dim hover:bg-bg-2 hover:text-ink transition" title="Help">
        <HelpCircle size={15} />
      </button>
    </div>
  );
}
