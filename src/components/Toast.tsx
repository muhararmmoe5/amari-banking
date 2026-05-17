'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastKind = 'ok' | 'err' | 'info' | 'saving';
interface ToastMsg {
  id: number;
  title: string;
  body?: string;
  kind: ToastKind;
}

interface ToastApi {
  toast: (m: Omit<ToastMsg, 'id'>) => void;
  saveStart: () => number;
  saveEnd: (id: number) => void;
  saveError: (id: number, msg?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((m: Omit<ToastMsg, 'id'>, autoHide = true) => {
    counter.current += 1;
    const id = counter.current;
    setItems((cur) => [...cur, { id, ...m }]);
    if (autoHide) setTimeout(() => remove(id), 2200);
    return id;
  }, [remove]);

  const toast = useCallback((m: Omit<ToastMsg, 'id'>) => { push(m, true); }, [push]);

  const saveStart = useCallback(() => push({ kind: 'saving', title: 'Saving…' }, false), [push]);
  const saveEnd = useCallback((id: number) => {
    setItems((cur) => cur.map((t) => (t.id === id ? { ...t, kind: 'ok', title: 'Saved' } : t)));
    setTimeout(() => remove(id), 1400);
  }, [remove]);
  const saveError = useCallback((id: number, msg?: string) => {
    setItems((cur) => cur.map((t) => (t.id === id ? { ...t, kind: 'err', title: 'Save failed', body: msg } : t)));
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  return (
    <Ctx.Provider value={{ toast, saveStart, saveEnd, saveError }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto surface-glass border rounded-xl px-4 py-3 min-w-[240px] max-w-sm shadow-elev-2 animate-toast-in ${
              t.kind === 'ok' ? 'border-income/40' :
              t.kind === 'err' ? 'border-expense/40' :
              t.kind === 'saving' ? 'border-entity-bytes/40' : 'border-line'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {t.kind === 'saving' ? <Spinner /> :
                t.kind === 'ok' ? <span className="w-5 h-5 rounded-full bg-income/15 text-income inline-flex items-center justify-center text-xs">✓</span> :
                t.kind === 'err' ? <span className="w-5 h-5 rounded-full bg-expense/15 text-expense inline-flex items-center justify-center text-xs">✕</span> : null}
              <div className="text-sm font-medium">{t.title}</div>
            </div>
            {t.body ? <div className="text-xs text-ink-dim mt-1 ml-7">{t.body}</div> : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

function Spinner() {
  return (
    <span className="inline-block w-3 h-3 rounded-full border-2 border-entity-bytes/30 border-t-entity-bytes animate-spin" />
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Outside provider — safe noop API
    return {
      toast: () => {},
      saveStart: () => 0,
      saveEnd: () => {},
      saveError: () => {},
    };
  }
  return ctx;
}
