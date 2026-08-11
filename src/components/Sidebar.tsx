'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Upload,
  Table2,
  ArrowLeftRight,
  ShieldCheck,
  PieChart,
  Wallet,
  Users,
  TrendingUp,
  Activity,
  DollarSign,
  FileText,
  Download,
  SlidersHorizontal,
  Settings,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

type NavItem = { href: string; label: string; icon: any; tag?: string; flagBadge?: boolean; unclaimedBadge?: boolean; ownerOnly?: boolean };
type NavSection = { sec: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    sec: 'Banking',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, ownerOnly: true },
      { href: '/import', label: 'Import CSV', icon: Upload, ownerOnly: true },
      { href: '/transactions', label: 'Transactions', icon: Table2, ownerOnly: true },
      { href: '/reconcile', label: 'Reconciliation', icon: ArrowLeftRight, ownerOnly: true },
      { href: '/audit', label: 'Audit Review', icon: ShieldCheck, flagBadge: true, ownerOnly: true },
    ],
  },
  {
    sec: 'Shared',
    items: [
      // Visible to everyone (no ownerOnly). Cofounders — PARTNER/TEAM_MEMBER
      // — need to reach this queue to claim their own charges.
      { href: '/identify', label: 'Identify charges', icon: Users, unclaimedBadge: true },
    ],
  },
  {
    sec: 'Capital',
    items: [
      { href: '/cap', label: 'Cap Table', icon: PieChart },
      { href: '/budgets', label: 'Budgets', icon: Wallet, ownerOnly: true },
      { href: '/salaries', label: 'Salaries', icon: Users, ownerOnly: true },
      { href: '/personal', label: 'Personal finance', icon: Wallet, ownerOnly: true },
      { href: '/team', label: 'Team & Investors', icon: Users, ownerOnly: true },
    ],
  },
  {
    sec: 'Reports',
    items: [
      { href: '/pl', label: 'Entity P&L', icon: TrendingUp, ownerOnly: true },
      { href: '/flow', label: 'Cash Flow', icon: Activity, ownerOnly: true },
      { href: '/income', label: 'Income Tracker', icon: DollarSign, ownerOnly: true },
      { href: '/zelle', label: 'Zelle / 1099', icon: FileText, ownerOnly: true },
      { href: '/cpa', label: 'CPA Export', icon: Download, ownerOnly: true },
      { href: '/accounts', label: 'Accounts', icon: Wallet, ownerOnly: true },
    ],
  },
  {
    sec: 'Admin',
    items: [
      { href: '/admin/options', label: 'Dropdown options', icon: SlidersHorizontal, ownerOnly: true },
    ],
  },
];

export default function Sidebar({
  openFlags, unclaimedCount, role, userName, userEmail,
}: {
  openFlags?: number;
  unclaimedCount?: number;
  role?: 'OWNER' | 'EDITOR' | 'PARTNER' | 'TEAM_MEMBER';
  userName?: string;
  userEmail?: string;
}) {
  const path = usePathname();
  // OWNER and EDITOR both see the full sidebar and can hit every write path.
  const isOwner = role === 'OWNER' || role === 'EDITOR';
  const initials = (userName || userEmail || '?').slice(0, 2).toUpperCase();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-close the mobile drawer whenever the user navigates.
  useEffect(() => { setMobileOpen(false); }, [path]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.href = '/login';
  }

  return (
    <>
      {/* Mobile top bar — only visible on small screens */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-[52px] bg-bg-1 border-b border-line flex items-center px-3 gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="p-2 -ml-2 text-ink-dim hover:text-ink"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div
          className="w-7 h-7 grid place-items-center rounded-lg text-bg-0 font-normal italic"
          style={{
            background: 'radial-gradient(circle at 30% 30%, color-mix(in oklab, #c9a87a 92%, white), color-mix(in oklab, #c9a87a 60%, black)), #c9a87a',
            fontFamily: 'var(--font-serif)',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          A
        </div>
        <div className="font-semibold text-[14px] tracking-tight">Amari Banking</div>
      </div>

      {/* Backdrop — only when drawer is open on mobile */}
      {mobileOpen ? (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={clsx(
          'w-[232px] shrink-0 border-r border-line bg-bg-1 flex flex-col overflow-hidden z-40',
          // Desktop: sticky sidebar
          'md:sticky md:top-0 md:min-h-screen md:translate-x-0',
          // Mobile: fixed drawer that slides in/out
          'fixed top-0 left-0 bottom-0 transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
      {/* Brand */}
      <div className="px-[18px] py-[18px] pb-[14px] flex items-center gap-2.5">
        <div
          className="w-7 h-7 grid place-items-center rounded-lg text-bg-0 font-normal italic"
          style={{
            background: 'radial-gradient(circle at 30% 30%, color-mix(in oklab, #c9a87a 92%, white), color-mix(in oklab, #c9a87a 60%, black)), #c9a87a',
            fontFamily: 'var(--font-serif)',
            fontSize: 18,
            lineHeight: 1,
            boxShadow: '0 0 0 1px rgba(255,255,255,.06), 0 1px 0 rgba(0,0,0,.4), 0 0 28px -6px rgba(201,168,122,.45)',
          }}
        >
          A
        </div>
        <div>
          <div className="font-semibold text-[14px] tracking-tight">Amari Banking</div>
          <div className="text-[10.5px] text-ink-mute mt-px tracking-wide">Multi-entity audit</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden">
        {NAV_SECTIONS.map(({ sec, items }) => {
          const visible = items.filter((n) => isOwner || !n.ownerOnly);
          if (visible.length === 0) return null;
          return (
            <div key={sec} className="px-2.5 pt-3.5 pb-1">
              <div className="section-label px-2 pb-1.5">{sec}</div>
              {visible.map((n) => {
                const isActive = n.href === '/' ? path === '/' : path?.startsWith(n.href);
                const Icon = n.icon;
                const tag = n.flagBadge && openFlags
                  ? (openFlags > 99 ? '99+' : String(openFlags))
                  : n.unclaimedBadge && unclaimedCount
                    ? (unclaimedCount > 99 ? '99+' : String(unclaimedCount))
                    : n.tag;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={clsx(
                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12.5px] my-0.5',
                      'transition-colors duration-75',
                      isActive
                        ? 'bg-bg-2 text-ink'
                        : 'text-ink-dim hover:bg-bg-2 hover:text-ink'
                    )}
                    style={isActive ? { boxShadow: 'inset 2px 0 0 var(--color-accent, #c9a87a)' } : undefined}
                  >
                    <Icon
                      size={14}
                      strokeWidth={1.75}
                      className={isActive ? 'text-accent' : 'text-ink-mute'}
                      style={isActive ? { color: '#c9a87a' } : undefined}
                    />
                    <span className="leading-tight">{n.label}</span>
                    {tag ? (
                      <span className="ml-auto mono text-[10.5px] text-ink-mute">{tag}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer — user + build stamp */}
      <div className="mt-auto border-t border-line p-3">
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2 px-2.5 py-2 bg-bg-2 border border-line rounded-md hover:bg-bg-3 transition group"
          title="Sign out"
        >
          <div
            className="w-[22px] h-[22px] rounded-md grid place-items-center text-bg-0 font-bold text-[10.5px]"
            style={{ background: 'linear-gradient(135deg, #c9a87a, #88724a)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-[12px] font-medium truncate">{userName || userEmail || 'User'}</div>
            <div className="text-[10.5px] text-ink-mute truncate">{role ? role.toLowerCase().replace('_', ' ') : 'signed in'}</div>
          </div>
          <LogOut size={12} className="text-ink-mute group-hover:text-expense transition" />
        </button>
        <div className="mono text-[10px] text-ink-ghost px-2 pt-2">v.intent-owner · main</div>
      </div>
    </aside>
    </>
  );
}
