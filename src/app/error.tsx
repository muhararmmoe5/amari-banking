'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Global error boundary. Anything that throws inside a page or a nested
 * server component below `app/` lands here instead of Next's default red
 * error screen. `reset()` retries the segment; the sign-in link is the
 * fallback for cases where the session was blown away.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log to the server console (visible in Railway deploy logs) for
    // triage; digest ties this render to the server-side stack.
    console.error('[app/error]', error.digest, error.message);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-0)' }}>
      <div className="card p-10 text-center max-w-md">
        <div style={{ fontSize: 40, marginBottom: 4 }}>⚠️</div>
        <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
        <p className="text-sm text-ink-dim mb-2">
          The page couldn&apos;t finish rendering. Try again, or head somewhere else.
        </p>
        {error.digest ? (
          <div style={{ fontSize: 10.5, color: 'var(--ink-4, #44443f)', marginBottom: 20 }}>
            digest: <span className="num">{error.digest}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => reset()} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn">Dashboard</Link>
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
