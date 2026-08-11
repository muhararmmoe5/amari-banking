import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFINITIONS, executeTool, type ToolResult } from '@/lib/ai/tools';
import { getCurrentUser, hasEditAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7';
const MAX_TOOL_ROUNDS = 8;

const SYSTEM_PROMPT = `You are the Amari Banking assistant — a financial reconciliation copilot for Moe Muharram's multi-entity business portfolio.

## Context

You operate inside a Next.js dashboard that imports Chase CSV exports and categorizes every transaction. The data is local, private, and already imported into a SQLite database when the user talks to you. You can read it via tools.

## The 4 business entities

- **Bytes AI** — SaaS / AI restaurant tech. Revenue: Stripe, Uber Eats. Software stack: LiveKit, Anthropic, OpenAI, Telnyx, VAPI, Twilio, Cursor, Linear, Replit, Vercel, Supabase, etc.
- **Rocket Wireless** — California telecom retail stores. Revenue: TCETRA / Vidapay carrier commissions. COGS: North Bridge Wireless.
- **Delicious Bytes LLC** — Ghost kitchen / food delivery. Revenue: DoorDash, Grubhub. Vendors: NYC Apple Deli, Mr Pizza Man. Rent: KitchenHub.
- **Amari Ventures LLC** — Holding company. Receives Spacetel LLC wires (and Omar M Alghazali CHIPS credits — same address, likely same entity).

A separate "Personal" bucket holds Moe's personal accounts (notably ···7056).

## The 15 Chase accounts

\`···0320\` Amari Ventures Hub — receives all Spacetel wires
\`···0709\` Rocket Wireless Ops
\`···0717\` Personal / Holding
\`···2127\` Bytes AI (Uber Eats, Facebook Ads)
\`···2151\` Delicious Bytes secondary
\`···2305\` Rocket Wireless / TCETRA secondary
\`···2871\` Delicious Bytes main (DoorDash/Grubhub)
\`···5975\` Savings / ODP reserve (dormant)
\`···6562\` Bytes AI main (Stripe)
\`···6612\` Bytes Restaurant Tech — Gusto payroll only
\`···6798\` Holding / dormant
\`···7056\` Personal — Moe Main (every outflow needs business-vs-personal classification)
\`···9190\` Bytes AI / Delicious Bytes mixed
\`···9810\` Rocket Wireless funding
\`···9828\` Rocket Wireless / TCETRA main (highest volume)

## Tools you have

- \`list_transactions\` — fetch up to 50 raw transaction rows matching filters. Use for "show me X" or when you need specific rows. Filters: account_id, entity, category, audit_status, search, zelle_only, wires_only, income_source, zelle_person, min/max_amount, date_from/to, flagged_only.
- \`summarize_transactions\` — group totals by entity, category, account, month, income_source, zelle_person, or audit_status. Use for "how much…", "total…", "spend by…".
- \`download_csv\` — generate a CSV the user can download. Use when they ask to "export", "download", "save as csv", or "get a csv of…".
- \`navigate_to\` — open a page in the app (transactions, audit, zelle, cpa, income, pl, accounts, reconcile, dashboard). Use for "show me in the app", "open…", "bring up…".

## Style

- Be brief. Lead with the answer; supporting detail follows.
- When the user asks to "see" or "bring up" data, prefer \`navigate_to\` so they get the full UI. Use \`list_transactions\` only for inline summaries.
- When they ask for a "csv" or "export", call \`download_csv\` and then say one line confirming what the file contains.
- Use the entity short names (Bytes AI, Rocket Wireless, Delicious Bytes, Amari Ventures, Personal) — not the database enums.
- Format money with US thousands separators and a leading $. Negative amounts are expenses.
- If a filter could be either positive or negative (e.g., "Spacetel"), ask one quick clarifying question rather than guessing.
- Today is ${new Date().toISOString().slice(0, 10)}.`;

interface ClientMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ApiResponseTurn {
  text: string;
  toolCalls: { name: string; input: any; ui?: ToolResult['ui'] }[];
  stop_reason: string;
  usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
}

export async function POST(req: NextRequest) {
  // Gate on hasEditAccess so anonymous callers can't burn Anthropic budget
  // or invoke the AI tools that read/mutate the DB.
  const user = getCurrentUser();
  if (!user || !hasEditAccess(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'missing_api_key',
        message: 'AI features are off — no Anthropic API key configured. On Railway: Service → Variables → add ANTHROPIC_API_KEY = sk-ant-… and redeploy.',
      },
      { status: 500 }
    );
  }

  let body: { messages?: ClientMessage[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const incoming = body.messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: 'no_messages' }, { status: 400 });
  }
  if (incoming.some((m) => typeof m.content !== 'string' || m.content.length > 4000)) {
    return NextResponse.json({ error: 'invalid_messages' }, { status: 400 });
  }
  if (incoming.length > 30) {
    return NextResponse.json({ error: 'too_many_messages', message: 'Start a new chat to continue.' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  // Build initial messages — content is text-only on the user side
  const messages: Anthropic.MessageParam[] = incoming.map((m) => ({
    role: m.role,
    content: [{ type: 'text', text: m.content }],
  }));

  const collectedToolCalls: ApiResponseTurn['toolCalls'] = [];
  let finalText = '';
  let finalUsage: ApiResponseTurn['usage'] = {};
  let stopReason = 'end_turn';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: TOOL_DEFINITIONS,
        messages,
      });
    } catch (err: any) {
      if (err instanceof Anthropic.AuthenticationError) {
        return NextResponse.json({ error: 'bad_api_key', message: 'Your Anthropic API key was rejected.' }, { status: 401 });
      }
      if (err instanceof Anthropic.RateLimitError) {
        return NextResponse.json({ error: 'rate_limited', message: 'Rate limited by Anthropic. Try again in a moment.' }, { status: 429 });
      }
      if (err instanceof Anthropic.APIError) {
        return NextResponse.json({ error: 'anthropic_error', message: err.message, status: err.status }, { status: 502 });
      }
      // eslint-disable-next-line no-console
      console.error('[ai/chat]', err);
      return NextResponse.json({ error: 'unknown', message: String(err?.message || err) }, { status: 500 });
    }

    // Accumulate usage
    if (response.usage) {
      finalUsage = {
        input_tokens: (finalUsage.input_tokens || 0) + (response.usage.input_tokens || 0),
        output_tokens: (finalUsage.output_tokens || 0) + (response.usage.output_tokens || 0),
        cache_read_input_tokens: (finalUsage.cache_read_input_tokens || 0) + (response.usage.cache_read_input_tokens || 0),
        cache_creation_input_tokens: (finalUsage.cache_creation_input_tokens || 0) + (response.usage.cache_creation_input_tokens || 0),
      };
    }

    stopReason = response.stop_reason || 'end_turn';

    if (response.stop_reason !== 'tool_use') {
      // Final assistant turn — extract text
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }

    // Execute tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    // Push assistant turn with the tool_use blocks
    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tool of toolUseBlocks) {
      try {
        const result = await executeTool(tool.name, tool.input);
        collectedToolCalls.push({ name: tool.name, input: tool.input, ui: result.ui });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: [{ type: 'text', text: result.llmText }],
        });
      } catch (err: any) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: [{ type: 'text', text: `Error: ${err?.message || 'tool failed'}` }],
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalText && collectedToolCalls.length > 0) {
    finalText = '(no text response — see the action card above)';
  }

  const out: ApiResponseTurn = {
    text: finalText || '',
    toolCalls: collectedToolCalls,
    stop_reason: stopReason,
    usage: finalUsage,
  };

  return NextResponse.json(out);
}
