'use client';

import { useState, useTransition } from 'react';
import { redeemInviteAction } from './actions';

export default function InviteForm({ token, defaultName, email }: { token: string; defaultName: string; email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTx(async () => {
      const res = await redeemInviteAction(token, fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <label className="block">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Email</div>
        <input value={email} disabled className="w-full opacity-70" />
      </label>
      <label className="block">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Your name</div>
        <input name="name" defaultValue={defaultName} required autoFocus className="w-full" />
      </label>
      <label className="block">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Choose a password</div>
        <input name="password" type="password" required minLength={12} maxLength={128} className="w-full" autoComplete="new-password" />
        <p className="text-[11px] text-ink-mute mt-1">12+ characters, with 3 of: lowercase, uppercase, digit, symbol.</p>
      </label>
      {error ? <p className="text-xs text-flag-critText">{error}</p> : <p className="text-xs text-ink-mute" />}
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
        {pending ? 'Setting up…' : 'Create account & sign in'}
      </button>
    </form>
  );
}
