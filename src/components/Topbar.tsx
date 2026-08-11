'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search, Calendar, ChevronDown, Upload, Download, Tag } from 'lucide-react';

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
  const [searchInput, setSearchInput] = useState('');

  function setPeriod(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (!next) sp.delete('period');
    else sp.set('period', next);
    router.push('?' + sp.toString());
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    // Route to the transactions list with the search prefilled — that page
    // reads `search` from its `SearchProps` and applies it via listTransactions.
    router.push(`/transactions?search=${encodeURIComponent(q)}`);
  }

  return (
    <div className="hidden md:flex h-14 flex-none border-b border-line surface-glass items-center px-6 gap-3.5 sticky top-0 z-20">
      {/* Entity scope — display-only badge (was a dead placeholder button
          claiming a switcher; we removed the switcher UI until it's real). */}
      <div
        className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-md bg-bg-2 border border-line"
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
          <span className="text-[10.5px] text-ink-mute">6 entities · 15 accounts</span>
        </div>
      </div>

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

      {/* Search — submits to /transactions?search=… */}
      <form
        onSubmit={submitSearch}
        className="flex items-center gap-2 bg-bg-2 border border-line px-3 py-1.5 rounded-md text-ink-mute min-w-[280px] focus-within:border-line-2 transition"
      >
        <Search size={13} />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1 !bg-transparent !border-0 !p-0 !text-[12.5px] !text-ink !rounded-none focus:!shadow-none placeholder:text-ink-mute"
          placeholder="Search transactions, merchants…"
          aria-label="Search transactions"
        />
        <kbd>↵</kbd>
      </form>

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
      {/* The AI assistant / notifications / help icon buttons that were
          previously here weren't wired to anything and just ate clicks.
          Removed until we have real implementations. */}
    </div>
  );
}
