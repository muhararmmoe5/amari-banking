'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { redeemPasswordResetAction } from './actions';

export default function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTx] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get('password') || '');
    const confirm = String(fd.get('confirm') || '');
    if (pw !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    startTx(async () => {
      const res = await redeemPasswordResetAction(token, fd);
      if (res.error) setError(res.error);
      else router.push('/');
    });
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <label className="block">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">New password</div>
        <input name="password" type="password" required autoFocus className="w-full" autoComplete="new-password" minLength={12} />
        <div className="text-[11px] text-ink-mute mt-1">12+ chars, 3 of: lowercase, uppercase, digit, symbol.</div>
      </label>
      <label className="block">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Confirm new password</div>
        <input name="confirm" type="password" required className="w-full" autoComplete="new-password" minLength={12} />
      </label>
      {error ? <p className="text-xs text-flag-critText">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
        {pending ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}
