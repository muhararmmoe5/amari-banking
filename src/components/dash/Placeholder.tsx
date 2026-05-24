'use client';

import { useDashCtx } from './DashCtx';
import { ENTITIES } from '@/lib/dash/fixtures';

export function Placeholder({ title, sub }: { title: string; sub?: string }) {
  const { mode, entity } = useDashCtx();
  const ent = ENTITIES[entity];
  const scope = mode === 'personal' ? 'PERSONAL' : `BUSINESS · ${ent.short.toUpperCase()}`;
  return (
    <div className="ds-page">
      <div className="ds-page-h">
        <div className="ds-page-h-l">
          <div className="ds-page-eyebrow">{scope}</div>
          <h1 className="ds-page-title">
            <em>{title}</em>
          </h1>
          {sub ? <div className="ds-page-sub">{sub}</div> : null}
        </div>
      </div>
      <div className="ds-soon">
        <div className="ds-soon-mark">…</div>
        <div className="ds-soon-ttl">
          <em>{title}</em> page is being built.
        </div>
        <div className="ds-soon-sub">
          Foundation is in place. Open <b style={{ color: 'var(--ds-ink-2)' }}>Banks &amp; Cards</b> for a finished page.
        </div>
      </div>
    </div>
  );
}
