import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-0)' }}>
      <div className="card p-10 text-center max-w-md">
        <div style={{ fontSize: 40, marginBottom: 4 }}>🚧</div>
        <h1 className="text-lg font-semibold mb-2">Page not found</h1>
        <p className="text-sm text-ink-dim mb-6">
          The URL you tried doesn&apos;t match any page in this app. Might be a stale link
          or a typo in the address bar.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Link href="/" className="btn btn-primary">Back to dashboard</Link>
          <Link href="/transactions" className="btn">Transactions</Link>
        </div>
      </div>
    </div>
  );
}
