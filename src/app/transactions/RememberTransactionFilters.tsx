'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Companion to BackToTransactionsLink. Mounted on /transactions,
 * writes the current search string to sessionStorage on every filter
 * change so the detail page's Back link can restore it.
 *
 * Cheap — one write per navigation. Rendered as a null fragment.
 */
export default function RememberTransactionFilters() {
  const params = useSearchParams();
  useEffect(() => {
    try {
      const q = params.toString();
      sessionStorage.setItem('tx.filters', q ? '?' + q : '');
    } catch {
      /* storage disabled */
    }
  }, [params]);
  return null;
}
