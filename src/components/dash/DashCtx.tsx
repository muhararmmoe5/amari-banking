'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { Mode, EntityId } from '@/lib/dash/types';
import { ENTITIES, ENTITY_ORDER } from '@/lib/dash/fixtures';

type Ctx = {
  mode: Mode;
  entity: EntityId;
  setMode: (m: Mode) => void;
  setEntity: (e: EntityId) => void;
};

const DashCtxObj = createContext<Ctx | null>(null);

function readHash(): { mode?: Mode; entity?: EntityId } {
  if (typeof window === 'undefined') return {};
  const h = window.location.hash.replace(/^#/, '');
  const p = new URLSearchParams(h);
  const m = p.get('mode');
  const e = p.get('entity');
  return {
    mode: m === 'personal' || m === 'business' ? m : undefined,
    entity: ENTITY_ORDER.includes(e as EntityId) ? (e as EntityId) : undefined,
  };
}

function readStorage(): { mode?: Mode; entity?: EntityId } {
  if (typeof window === 'undefined') return {};
  try {
    const m = localStorage.getItem('amari.mode');
    const e = localStorage.getItem('amari.entity');
    return {
      mode: m === 'personal' || m === 'business' ? m : undefined,
      entity: ENTITY_ORDER.includes(e as EntityId) ? (e as EntityId) : undefined,
    };
  } catch {
    return {};
  }
}

function applyAccent(mode: Mode, entity: EntityId) {
  if (typeof document === 'undefined') return;
  const c = mode === 'personal' ? '#c9a87a' : ENTITIES[entity].c;
  document.documentElement.style.setProperty('--ds-accent', c);
  document.documentElement.style.setProperty(
    '--ds-accent-glow',
    `color-mix(in oklab, ${c} 14%, transparent)`
  );
}

export function DashCtxProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Mode>('business');
  const [entity, setEntityState] = useState<EntityId>('bytes');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const fromHash = readHash();
    const fromStore = readStorage();
    const m = fromHash.mode ?? fromStore.mode ?? 'business';
    const e = fromHash.entity ?? fromStore.entity ?? ENTITY_ORDER[0];
    setModeState(m);
    setEntityState(e);
    applyAccent(m, e);
    setHydrated(true);
  }, []);

  const persist = useCallback((m: Mode, e: EntityId) => {
    try {
      localStorage.setItem('amari.mode', m);
      localStorage.setItem('amari.entity', e);
    } catch {
      /* ignore */
    }
    const h = new URLSearchParams();
    h.set('mode', m);
    if (m === 'business') h.set('entity', e);
    history.replaceState(null, '', '#' + h.toString());
    applyAccent(m, e);
  }, []);

  const setMode = useCallback(
    (m: Mode) => {
      setModeState(m);
      persist(m, entity);
    },
    [entity, persist]
  );
  const setEntity = useCallback(
    (e: EntityId) => {
      setEntityState(e);
      persist(mode, e);
    },
    [mode, persist]
  );

  const value = useMemo<Ctx>(() => ({ mode, entity, setMode, setEntity }), [mode, entity, setMode, setEntity]);

  void hydrated;
  return <DashCtxObj.Provider value={value}>{children}</DashCtxObj.Provider>;
}

export function useDashCtx(): Ctx {
  const v = useContext(DashCtxObj);
  if (!v) throw new Error('useDashCtx must be used inside DashCtxProvider');
  return v;
}
