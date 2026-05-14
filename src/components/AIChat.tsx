'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, X, Send, Download, ExternalLink, AlertCircle, Loader2,
} from 'lucide-react';

interface UiPayload {
  kind: string;
  csvId?: string;
  filename?: string;
  rowCount?: number;
  sizeBytes?: number;
  url?: string;
  label?: string;
  rows?: any[];
  total?: number;
  truncated?: boolean;
  groups?: { key: string; total: number; count: number }[];
  groupBy?: string;
}

interface ToolCall {
  name: string;
  input: any;
  ui?: UiPayload;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  error?: string;
}

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const SUGGESTIONS = [
  'Bring up all Zelle transactions',
  'Total spend by entity this month',
  'Export every Spacetel wire to a CSV',
  'Show me all wires over $1,000',
];

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  async function send(text: string) {
    if (busy || !text.trim()) return;
    const userMsg: Message = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.message || data.error || 'Request failed';
        setMessages((m) => [...m, { role: 'assistant', content: '', error: msg }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: data.text || '', toolCalls: data.toolCalls || [] },
        ]);
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: '', error: e?.message || 'Network error' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMessages([]);
    setInput('');
  }

  function onNavigate(url: string) {
    router.push(url);
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium text-bg-0 shadow-soft hover:opacity-90 transition"
          style={{ background: 'linear-gradient(135deg, #C8F060 0%, #60C8F0 100%)' }}
        >
          <Sparkles size={16} strokeWidth={2} />
          Ask AI
        </button>
      ) : (
        <div className="fixed bottom-5 right-5 z-40 w-[min(420px,calc(100vw-32px))] h-[min(640px,calc(100vh-48px))] flex flex-col card overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b border-line">
            <div className="flex items-center gap-2">
              <span
                className="w-6 h-6 rounded-full inline-flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #C8F060 0%, #60C8F0 100%)' }}
              >
                <Sparkles size={12} strokeWidth={2.5} className="text-bg-0" />
              </span>
              <div>
                <div className="text-sm font-medium leading-none">Amari AI</div>
                <div className="text-[10px] text-ink-mute leading-none mt-0.5">Reads your local data, never leaves your machine</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 ? (
                <button type="button" onClick={reset} className="text-[11px] text-ink-mute hover:text-ink px-2 py-1">
                  New chat
                </button>
              ) : null}
              <button type="button" onClick={() => setOpen(false)} className="text-ink-mute hover:text-ink p-1">
                <X size={16} />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-ink-dim">Ask anything about your imported data, or have me do something:</p>
                <div className="grid gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="text-left text-xs px-3 py-2 rounded-md bg-bg-2 hover:bg-bg-3 text-ink-dim hover:text-ink transition border border-line"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => <ChatBubble key={i} message={m} onNavigate={onNavigate} />)
            )}
            {busy ? (
              <div className="flex items-center gap-2 text-xs text-ink-mute">
                <Loader2 size={12} className="animate-spin" />
                Thinking…
              </div>
            ) : null}
          </div>

          <form
            className="p-3 border-t border-line"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                disabled={busy}
                placeholder="Ask the AI… (Enter to send, Shift+Enter for newline)"
                className="flex-1 resize-none text-sm"
                style={{ minHeight: 36, maxHeight: 120 }}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="btn btn-primary !p-2"
                title="Send"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function ChatBubble({ message: m, onNavigate }: { message: Message; onNavigate: (url: string) => void }) {
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg px-3 py-2 bg-bg-3 text-sm">
          {m.content}
        </div>
      </div>
    );
  }
  if (m.error) {
    return (
      <div className="flex items-start gap-2 text-xs text-flag-critText">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <div>{m.error}</div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {m.content ? (
        <div className="text-sm text-ink whitespace-pre-wrap">{m.content}</div>
      ) : null}
      {m.toolCalls?.map((tc, i) => (
        <ToolCard key={i} call={tc} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function ToolCard({ call, onNavigate }: { call: ToolCall; onNavigate: (url: string) => void }) {
  const ui = call.ui;
  if (!ui) return null;

  if (ui.kind === 'download') {
    return (
      <a
        href={`/api/ai/csv/${ui.csvId}`}
        download={ui.filename}
        className="block rounded-md border border-line bg-bg-2 hover:border-entity-bytes/40 transition p-3"
      >
        <div className="flex items-center gap-2">
          <Download size={14} className="text-entity-bytes" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{ui.filename}</div>
            <div className="text-[11px] text-ink-mute">
              {ui.rowCount?.toLocaleString()} rows · {fmtBytes(ui.sizeBytes || 0)}
            </div>
          </div>
          <span className="text-[11px] text-entity-bytes">Download</span>
        </div>
      </a>
    );
  }

  if (ui.kind === 'navigate') {
    return (
      <button
        type="button"
        onClick={() => ui.url && onNavigate(ui.url)}
        className="w-full text-left rounded-md border border-line bg-bg-2 hover:border-entity-bytes/40 transition p-3"
      >
        <div className="flex items-center gap-2">
          <ExternalLink size={14} className="text-entity-bytes" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{ui.label}</div>
            <div className="text-[11px] text-ink-mute mono truncate">{ui.url}</div>
          </div>
          <span className="text-[11px] text-entity-bytes">Open</span>
        </div>
      </button>
    );
  }

  if (ui.kind === 'rows') {
    if (!ui.rows || ui.rows.length === 0) {
      return (
        <div className="rounded-md border border-line bg-bg-2 p-3 text-xs text-ink-mute">
          No transactions match.
        </div>
      );
    }
    return (
      <div className="rounded-md border border-line bg-bg-2 overflow-hidden">
        <div className="px-3 py-2 text-[11px] text-ink-mute border-b border-line">
          {ui.rows.length}{ui.truncated ? '+' : ''} rows
        </div>
        <div className="max-h-56 overflow-y-auto divide-y divide-line/60">
          {ui.rows.slice(0, 20).map((r: any) => (
            <div key={r.id} className="px-3 py-2 text-xs grid grid-cols-[60px_1fr_auto] gap-2 items-center">
              <span className="mono text-[10px] text-ink-mute">{r.date.slice(5)}</span>
              <span className="truncate" title={r.description}>{r.merchant}</span>
              <span className={`mono tabnum ${r.amount > 0 ? 'text-income' : 'text-expense'}`}>
                {fmtMoney(r.amount)}
              </span>
            </div>
          ))}
        </div>
        {ui.rows.length > 20 ? (
          <div className="px-3 py-1.5 text-[10px] text-ink-mute border-t border-line">
            Showing first 20 of {ui.rows.length}{ui.truncated ? '+' : ''} — ask me to filter further, or export a CSV.
          </div>
        ) : null}
      </div>
    );
  }

  if (ui.kind === 'summary') {
    const max = Math.max(1, ...(ui.groups || []).map((g) => Math.abs(g.total)));
    return (
      <div className="rounded-md border border-line bg-bg-2 p-3 space-y-1.5">
        <div className="text-[11px] text-ink-mute mb-1">Grouped by {ui.groupBy}</div>
        {(ui.groups || []).slice(0, 12).map((g) => (
          <div key={g.key}>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-ink-dim">{g.key}</span>
              <span className={`mono tabnum ${g.total >= 0 ? 'text-income' : 'text-expense'}`}>
                {fmtMoney(g.total)}
              </span>
            </div>
            <div className="h-1 bg-bg-3 rounded mt-1 overflow-hidden">
              <div
                className={g.total >= 0 ? 'h-full bg-income' : 'h-full bg-expense'}
                style={{ width: `${(Math.abs(g.total) / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
