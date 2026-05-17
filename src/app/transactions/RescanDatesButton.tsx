'use client';

import { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';

export default function RescanDatesButton() {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  async function rescan() {
    if (busy) return;
    if (!confirm('Re-scan all transactions and pull out the real transaction date from each description? This is safe to run anytime; it only fills blank values.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/rescan-dates', { method: 'POST', credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) {
        toast({ kind: 'err', title: 'Rescan failed', body: data.error || `HTTP ${res.status}` });
      } else {
        toast({ kind: 'ok', title: `Populated ${data.populated} transaction dates`, body: `Scanned ${data.scanned}` });
        // Reload so the rendered rows pick up new values
        window.location.reload();
      }
    } catch (e: any) {
      toast({ kind: 'err', title: 'Network error', body: e?.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={rescan}
      disabled={busy}
      title="Re-extract transaction dates from descriptions for any rows currently missing one"
      className="btn text-xs"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
      {busy ? 'Scanning…' : 'Re-scan transaction dates'}
    </button>
  );
}
