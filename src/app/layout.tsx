import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';
import { portfolioSummary } from '@/lib/db/queries';

export const metadata: Metadata = {
  title: 'Amari Banking — Reconciliation',
  description: 'Multi-entity financial reconciliation and audit trail',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  let openFlags = 0;
  try {
    openFlags = portfolioSummary().openFlagCount;
  } catch {
    openFlags = 0;
  }
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar openFlags={openFlags} />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
