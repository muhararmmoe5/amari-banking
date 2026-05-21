import 'server-only';

// In-memory IP throttle. Good enough for the single-instance Railway deploy.
// If we ever run multiple replicas, swap this for a Redis-backed sliding window.

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 30;

const store = new Map<string, Bucket>();

function gc(now: number) {
  if (store.size < 1024) return;
  for (const [k, v] of store) if (v.resetAt < now) store.delete(k);
}

export function checkLoginRate(ip: string | null | undefined): { allowed: boolean; retryAfterSec?: number } {
  const key = (ip || 'unknown').trim() || 'unknown';
  const now = Date.now();
  gc(now);
  const b = store.get(key);
  if (!b || b.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  b.count += 1;
  if (b.count > MAX_ATTEMPTS_PER_IP) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { allowed: true };
}

// Password reset is more sensitive (sends real email), so the limit is tighter.
const RESET_WINDOW_MS = 60 * 60 * 1000;
const MAX_RESET_REQUESTS_PER_IP = 5;
const resetStore = new Map<string, Bucket>();

export function checkPasswordResetRate(ip: string | null | undefined): { allowed: boolean; retryAfterSec?: number } {
  const key = `reset:${(ip || 'unknown').trim() || 'unknown'}`;
  const now = Date.now();
  if (resetStore.size >= 1024) {
    for (const [k, v] of resetStore) if (v.resetAt < now) resetStore.delete(k);
  }
  const b = resetStore.get(key);
  if (!b || b.resetAt < now) {
    resetStore.set(key, { count: 1, resetAt: now + RESET_WINDOW_MS });
    return { allowed: true };
  }
  b.count += 1;
  if (b.count > MAX_RESET_REQUESTS_PER_IP) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { allowed: true };
}
