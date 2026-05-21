'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { requestPasswordResetAction } from './actions';

export default function ForgotForm() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error' | 'config'>('idle');
  const [message, setMessage] = useState<string>('');
  const [pending, startTx] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTx(async () => {
      const res = await requestPasswordResetAction(fd);
      if (res.configError === 'email_not_configured') {
        setStatus('config');
        setMessage('Email-based reset is not configured on this server yet. Contact your admin.');
        return;
      }
      if (res.rateLimited) {
        setStatus('error');
        setMessage(`Too many reset requests from this network. Try again in ${Math.ceil((res.retryAfterSec || 60) / 60)} min.`);
        return;
      }
      if (res.ok) {
        setStatus('sent');
        setMessage('If that email is on file, a reset link is on its way. Check your inbox (and spam folder). The link expires in 1 hour.');
        return;
      }
      setStatus('error');
      setMessage('Something went wrong. Try again.');
    });
  }

  if (status === 'sent') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-dim">{message}</p>
        <Link href="/login" className="btn btn-primary w-full justify-center">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <p className="text-xs text-ink-mute">Enter the email tied to your account. We&apos;ll send a single-use link valid for 1 hour.</p>
      <label className="block">
        <div className="text-[11px] uppercase tracking-wider text-ink-mute mb-1">Email</div>
        <input name="email" type="email" required autoFocus className="w-full" autoComplete="username" />
      </label>
      {status !== 'idle' && message ? (
        <p className={`text-xs ${status === 'config' || status === 'error' ? 'text-flag-critText' : 'text-ink-mute'}`}>{message}</p>
      ) : null}
      <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center">
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
      <p className="text-xs text-ink-mute text-center">
        Remembered it? <Link href="/login" className="text-entity-bytes">Sign in</Link>
      </p>
    </form>
  );
}
