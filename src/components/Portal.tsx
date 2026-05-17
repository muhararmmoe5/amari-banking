'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into <body> so they escape any ancestor's `transform`,
 * `filter`, `backdrop-filter`, etc. — those properties break `position: fixed`
 * by anchoring the fixed element to the transformed ancestor instead of the
 * viewport. We hit this with the virtualizer translating each row, which
 * was squishing our side drawers down to a row's height.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
