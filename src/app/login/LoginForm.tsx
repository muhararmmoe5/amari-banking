'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { loginAction } from './actions';

export default function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTx(async () => {
      const res = await loginAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <input type="hidden" name="next" value={next || '/'} />
      <label className="block">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Email</div>
        <input name="email" type="email" required autoFocus className="w-full" autoComplete="username" />
      </label>
      <label className="block">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Password</div>
        <input name="password" type="password" required className="w-full" autoComplete="current-password" />
      </label>
      {error ? <p className="text-xs text-flag-critText">{error}</p> : <p className="text-xs text-ink-mute" />}
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-xs text-ink-mute text-center pt-1">
        <Link href="/forgot-password" className="text-entity-bytes hover:underline">Forgot password?</Link>
      </p>
    </form>
  );
}
