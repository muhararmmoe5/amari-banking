/**
 * Claude-powered classifier for pending transactions.
 *
 * Runs a single batched Messages call per invocation with:
 * - system prompt: entity list, category hints, account map (cached).
 * - user message: JSON array of transaction summaries.
 * Returns Claude's structured suggestions per transaction.
 *
 * Uses prompt caching on the system message so the second and subsequent
 * calls in a session pay ~10% of the input-token price for the reference
 * material (entities, accounts, format spec).
 */

import Anthropic from '@anthropic-ai/sdk';
import { ACCOUNTS, ENTITY_LABELS, BUSINESS_ENTITIES } from '@/constants/accounts';

export interface ClassifyInput {
  txId: string;
  description: string;
  amount: number;
  postingDate: string;
  accountId: string;
  currentEntity: string | null;
  currentCategory: string | null;
  currentMerchant: string | null;
}

export interface ClassifySuggestion {
  txId: string;
  entity: string | null;
  category: string | null;
  individual: string | null;
  customSourceTag: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

function buildSystemPrompt(): string {
  const entities = [...BUSINESS_ENTITIES, 'PERSONAL' as const, 'MULTI_ENTITY' as const, 'UNKNOWN' as const]
    .map((e) => `  - ${e}: ${ENTITY_LABELS[e]}`)
    .join('\n');
  const accounts = ACCOUNTS.map((a) => `  - ····${a.last4} (${a.label}, ${a.entity}) — ${a.purpose}`).join('\n');
  return `You are a bookkeeping assistant for a multi-entity holding company. You classify individual bank transactions by (a) which legal entity they belong to, (b) the appropriate expense/income category, (c) the individual person responsible or receiving, and (d) a free-text "custom source tag" that describes the SPECIFIC origin/purpose beyond the category (e.g. on a Stripe payout that is a broad INCOME category — the custom tag might read "Bytes AI SaaS — client Acme, invoice #1234").

Entities available:
${entities}

Accounts and their default entity:
${accounts}

Guidance:
- If the description clearly matches a merchant (Anthropic, AWS, Stripe, Verizon, Whole Foods, Uber, DoorDash, Grubhub, Sysco, Gusto, TCETRA, Spacetel), use that to infer the category and entity.
- Zelle payments to a known person (JACKY, etc.) usually mean housing rent or contractor — set entity to PERSONAL for rent, otherwise use the person's known entity.
- Internal transfers between the user's own accounts should have entity matching the outgoing account's entity.
- CUSTOM SOURCE TAG rules:
  * For income (positive amount): identify the client/customer/product where possible ("Client Acme — invoice", "DoorDash marketplace payout", "Wire from investor Omar via Spacetel").
  * For expenses: identify the specific team/project/purpose ("Bytes AI production API", "Delicious Bytes kitchen rent", "Personal rent to Jacky").
  * For internal transfers: describe direction and purpose ("Owner draw for personal expenses", "Hub → Rocket working capital top-up").
  * Keep it under 80 characters. Be specific but readable.
- Confidence rubric:
  * high — merchant + entity + category are all unambiguous.
  * medium — merchant known but entity/category needs a call.
  * low — ambiguous merchant or unfamiliar pattern.

Categories to use for the "category" field (uppercase snake_case):
INCOME, INCOME_STRIPE, INCOME_SPACETEL, INCOME_TCETRA, INCOME_DOORDASH, INCOME_GRUBHUB, RENT, HOUSING, PAYROLL, SOFTWARE, MARKETING, TELECOM, GROCERIES, TRANSPORTATION, HEALTH, ENTERTAINMENT, COGS, OWNER_DRAW, INTERNAL_TRANSFER, FEE, UNCATEGORIZED.

You MUST respond with a JSON object of shape:
{"suggestions": [{"txId": "...", "entity": "...", "category": "...", "individual": "...", "customSourceTag": "...", "confidence": "high" | "medium" | "low", "reasoning": "..."}]}
Every field except txId may be null when you're not confident. Return one suggestion per input transaction, preserving the input txIds. No prose outside the JSON.`;
}

export async function classifyBatchWithClaude(
  batch: ClassifyInput[],
): Promise<ClassifySuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set — cannot run Claude classification');
  if (batch.length === 0) return [];

  const client = new Anthropic({ apiKey });

  // Cap batch size to keep the input token budget predictable.
  const bounded = batch.slice(0, 40);

  const userPayload = {
    transactions: bounded.map((t) => ({
      txId: t.txId,
      date: t.postingDate,
      description: t.description.slice(0, 200),
      amount: t.amount,
      account: t.accountId,
      currentEntity: t.currentEntity,
      currentCategory: t.currentCategory,
      currentMerchant: t.currentMerchant,
    })),
  };

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Classify these ${bounded.length} transactions and return the JSON object as specified.\n\n${JSON.stringify(userPayload)}`,
      },
    ],
  });

  const textBlock = res.content.find((c) => c.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return [];
  const raw = textBlock.text.trim();

  // Claude sometimes wraps the JSON in a code fence; strip either variant.
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1] : raw;

  try {
    const parsed = JSON.parse(jsonText) as { suggestions: ClassifySuggestion[] };
    if (!parsed || !Array.isArray(parsed.suggestions)) return [];
    // Filter to inputs we asked about and normalize confidence.
    const inputIds = new Set(bounded.map((b) => b.txId));
    return parsed.suggestions
      .filter((s) => s && typeof s.txId === 'string' && inputIds.has(s.txId))
      .map((s) => ({
        txId: s.txId,
        entity: s.entity || null,
        category: s.category || null,
        individual: s.individual || null,
        customSourceTag: s.customSourceTag || null,
        confidence: s.confidence === 'high' || s.confidence === 'medium' || s.confidence === 'low'
          ? s.confidence
          : 'low',
        reasoning: s.reasoning || '',
      }));
  } catch {
    return [];
  }
}
