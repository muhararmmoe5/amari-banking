'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * "Back to transactions" link that preserves the last-used filter state.
 *
 * How it works:
 *   1. Whenever the user is on /transactions (via the sibling
 *      RememberTransactionFilters component), the current search string
 *      is written to sessionStorage['tx.filters'].
 *   2. On mount here, we read that string and use it as the query on the
 *      Back link, so tapping it returns the user to their filtered view
 *      instead of the default (Pending review / all accounts / etc.).
 *
 * Falls back to plain /transactions when no stored filters exist (first
 * visit, bookmarked detail page, session reset).
 */
export default function BackToTransactionsLink({
  className, children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [href, setHref] = useState<string>('/transactions');

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('tx.filters');
      if (stored && stored.length > 0 && stored.length < 2000) {
        // Stored value is already prefixed with '?' by the writer.
        setHref('/transactions' + stored);
      }
    } catch {
      /* private browsing / storage disabled — silently keep default */
    }
  }, []);

  return (
    <Link href={href} className={className}>
      {children ?? (
        <>
          <ArrowLeft size={12} /> Back to transactions
        </>
      )}
    </Link>
  );
}
