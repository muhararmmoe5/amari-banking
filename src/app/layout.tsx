import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';
import AIChat from '@/components/AIChat';
import { portfolioSummary } from '@/lib/db/queries';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Amari Banking — Reconciliation',
  description: 'Multi-entity financial reconciliation and audit trail',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  let openFlags = 0;
  let user: ReturnType<typeof getCurrentUser> = null;
  try {
    user = getCurrentUser();
    if (user?.role === 'OWNER') openFlags = portfolioSummary().openFlagCount;
  } catch {
    /* ignore */
  }

  if (!user) {
    // Login / setup / invite pages render full-bleed (no sidebar).
    return (
      <html lang="en">
        <body>
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar openFlags={openFlags} role={user.role} userName={user.name} userEmail={user.email} />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
          {user.role === 'OWNER' ? <AIChat /> : null}
        </ToastProvider>
      </body>
    </html>
  );
}
