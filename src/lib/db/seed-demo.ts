/**
 * Demo data seeder.
 *
 * Populates the transactions table with a small, realistic dataset on first
 * boot when the table is empty AND env `SEED_DEMO_DATA=true`. Used so a fresh
 * Railway/Render deploy comes up with something to look at instead of an
 * empty list.
 *
 * Idempotent: if any transactions exist already, this is a no-op.
 */

import crypto from 'crypto';
import type Database from 'better-sqlite3';

interface SeedRow {
  postingDate: string;
  accountId: string;
  description: string;
  amount: number;
  type: string;
  merchant: string;
  category: string;
  entityTag: string;
  confirmedEntity?: string;
  individual?: string;
  isInternal?: boolean;
  internalLink?: string;
}

// Each row gets a stable `key` so we can resolve internal_linked_id refs.
const ROWS: (SeedRow & { key: string })[] = [
  // --- April: starting balances + Spacetel wire ---
  { key: 'sp-apr', postingDate: '2026-04-15', accountId: '0320', description: 'WIRE TRANSFER FROM SPACETEL LLC', amount: 10000, type: 'WIRE_IN', merchant: 'Spacetel LLC', category: 'INCOME_SPACETEL', entityTag: 'AMARI_VENTURES', confirmedEntity: 'AMARI_VENTURES', individual: 'Mohammed Muharram' },
  { key: 'stripe-apr', postingDate: '2026-04-18', accountId: '6562', description: 'STRIPE PAYOUT', amount: 4200, type: 'ACH_IN', merchant: 'Stripe', category: 'INCOME', entityTag: 'BYTES_AI', confirmedEntity: 'BYTES_AI', individual: 'Mohammed Muharram' },
  { key: 'tcetra-apr', postingDate: '2026-04-22', accountId: '9828', description: 'TCETRA PROCESSING DEPOSIT', amount: 8750, type: 'ACH_IN', merchant: 'TCETRA', category: 'INCOME', entityTag: 'ROCKET_WIRELESS', confirmedEntity: 'ROCKET_WIRELESS' },

  // --- April expenses on hub ---
  { key: 'rent-apr', postingDate: '2026-04-25', accountId: '0320', description: 'ZELLE PAYMENT TO JACKY JPM98...', amount: -4500, type: 'CHASE_TO_PARTNERFI', merchant: 'Zelle → Jacky', category: 'HOUSING', entityTag: 'PERSONAL', confirmedEntity: 'PERSONAL', individual: 'Mohammed Muharram' },
  { key: 'gusto-apr', postingDate: '2026-04-28', accountId: '6612', description: 'GUSTO PAYROLL', amount: -3200, type: 'ACH_OUT', merchant: 'Gusto', category: 'PAYROLL', entityTag: 'BYTES_REST_TECH', confirmedEntity: 'BYTES_REST_TECH' },

  // --- May Spacetel wire (the one shown in the user's screenshot) ---
  { key: 'sp-may', postingDate: '2026-05-04', accountId: '0320', description: 'WIRE TRANSFER FROM SPACETEL LLC', amount: 10000, type: 'WIRE_IN', merchant: 'Spacetel LLC', category: 'INCOME_SPACETEL', entityTag: 'AMARI_VENTURES', confirmedEntity: 'AMARI_VENTURES', individual: 'Mohammed Muharram' },

  // --- May expenses funded by the May Spacetel wire ---
  { key: 'jacky-may', postingDate: '2026-05-04', accountId: '0320', description: 'ZELLE PAYMENT TO JACKY JPM99cfrj8gs', amount: -4500, type: 'CHASE_TO_PARTNERFI', merchant: 'Zelle → Jacky', category: 'HOUSING', entityTag: 'PERSONAL', confirmedEntity: 'PERSONAL', individual: 'Mohammed Muharram' },
  { key: 'aws-may', postingDate: '2026-05-06', accountId: '0320', description: 'AWS BILLING', amount: -1240.55, type: 'ACH_OUT', merchant: 'Amazon Web Services', category: 'SOFTWARE', entityTag: 'BYTES_AI', confirmedEntity: 'BYTES_AI' },
  { key: 'verizon-may', postingDate: '2026-05-08', accountId: '0320', description: 'VERIZON WIRELESS', amount: -312.84, type: 'CARD', merchant: 'Verizon', category: 'TELECOM', entityTag: 'BUSINESS_SHARED', confirmedEntity: 'AMARI_VENTURES' },

  // --- Internal transfer: Hub → Rocket Wireless funding ---
  { key: 'xfer-out-rkt', postingDate: '2026-05-10', accountId: '0320', description: 'TRANSFER TO ROCKET WIRELESS 9190', amount: -2500, type: 'TRANSFER', merchant: 'Internal Transfer', category: 'INTERNAL_TRANSFER', entityTag: 'AMARI_VENTURES', confirmedEntity: 'AMARI_VENTURES', isInternal: true, internalLink: 'xfer-in-rkt' },
  { key: 'xfer-in-rkt', postingDate: '2026-05-10', accountId: '9810', description: 'TRANSFER FROM AMARI HUB 0320', amount: 2500, type: 'TRANSFER', merchant: 'Internal Transfer', category: 'INTERNAL_TRANSFER', entityTag: 'ROCKET_WIRELESS', confirmedEntity: 'ROCKET_WIRELESS', isInternal: true, internalLink: 'xfer-out-rkt' },

  // --- May income to Bytes AI ---
  { key: 'stripe-may1', postingDate: '2026-05-05', accountId: '6562', description: 'STRIPE PAYOUT', amount: 3800, type: 'ACH_IN', merchant: 'Stripe', category: 'INCOME', entityTag: 'BYTES_AI', confirmedEntity: 'BYTES_AI' },
  { key: 'stripe-may2', postingDate: '2026-05-12', accountId: '6562', description: 'STRIPE PAYOUT', amount: 5200, type: 'ACH_IN', merchant: 'Stripe', category: 'INCOME', entityTag: 'BYTES_AI', confirmedEntity: 'BYTES_AI' },

  // --- May expenses on Bytes AI ---
  { key: 'openai-may', postingDate: '2026-05-09', accountId: '6562', description: 'ANTHROPIC API USAGE', amount: -847.12, type: 'CARD', merchant: 'Anthropic', category: 'SOFTWARE', entityTag: 'BYTES_AI', confirmedEntity: 'BYTES_AI' },
  { key: 'fb-may', postingDate: '2026-05-11', accountId: '2127', description: 'FACEBOOK ADS', amount: -625.40, type: 'CARD', merchant: 'Meta Ads', category: 'MARKETING', entityTag: 'BYTES_AI', confirmedEntity: 'BYTES_AI' },

  // --- Personal transfers (owner draws) ---
  { key: 'draw-may', postingDate: '2026-05-13', accountId: '0320', description: 'OWNER DRAW TO PERSONAL 7056', amount: -2000, type: 'TRANSFER', merchant: 'Owner Draw', category: 'OWNER_DRAW', entityTag: 'AMARI_VENTURES', confirmedEntity: 'AMARI_VENTURES', individual: 'Mohammed Muharram', isInternal: true, internalLink: 'draw-in-may' },
  { key: 'draw-in-may', postingDate: '2026-05-13', accountId: '7056', description: 'OWNER DRAW FROM AMARI HUB', amount: 2000, type: 'TRANSFER', merchant: 'Owner Draw', category: 'OWNER_DRAW', entityTag: 'PERSONAL', confirmedEntity: 'PERSONAL', individual: 'Mohammed Muharram', isInternal: true, internalLink: 'draw-may' },

  // --- Personal expenses ---
  { key: 'whole-may', postingDate: '2026-05-14', accountId: '7056', description: 'WHOLE FOODS MARKET', amount: -187.42, type: 'CARD', merchant: 'Whole Foods', category: 'GROCERIES', entityTag: 'PERSONAL', confirmedEntity: 'PERSONAL', individual: 'Mohammed Muharram' },
  { key: 'uber-may', postingDate: '2026-05-15', accountId: '7056', description: 'UBER TRIP', amount: -42.30, type: 'CARD', merchant: 'Uber', category: 'TRANSPORTATION', entityTag: 'PERSONAL', confirmedEntity: 'PERSONAL', individual: 'Mohammed Muharram' },
  { key: 'gym-may', postingDate: '2026-05-16', accountId: '7056', description: 'EQUINOX MEMBERSHIP', amount: -325, type: 'CARD', merchant: 'Equinox', category: 'HEALTH', entityTag: 'PERSONAL', confirmedEntity: 'PERSONAL', individual: 'Mohammed Muharram' },

  // --- Rocket Wireless ops ---
  { key: 'tcetra-may1', postingDate: '2026-05-07', accountId: '9828', description: 'TCETRA PROCESSING DEPOSIT', amount: 12400, type: 'ACH_IN', merchant: 'TCETRA', category: 'INCOME', entityTag: 'ROCKET_WIRELESS', confirmedEntity: 'ROCKET_WIRELESS' },
  { key: 'tcetra-may2', postingDate: '2026-05-14', accountId: '9828', description: 'TCETRA PROCESSING DEPOSIT', amount: 9850, type: 'ACH_IN', merchant: 'TCETRA', category: 'INCOME', entityTag: 'ROCKET_WIRELESS', confirmedEntity: 'ROCKET_WIRELESS' },
  { key: 'rkt-rent', postingDate: '2026-05-12', accountId: '9828', description: 'WAREHOUSE RENT — 1099 OAK ST', amount: -3200, type: 'ACH_OUT', merchant: 'Oak Street LLC', category: 'RENT', entityTag: 'ROCKET_WIRELESS', confirmedEntity: 'ROCKET_WIRELESS' },
  { key: 'rkt-payroll', postingDate: '2026-05-15', accountId: '9828', description: 'GUSTO PAYROLL', amount: -5400, type: 'ACH_OUT', merchant: 'Gusto', category: 'PAYROLL', entityTag: 'ROCKET_WIRELESS', confirmedEntity: 'ROCKET_WIRELESS' },

  // --- Delicious Bytes ---
  { key: 'dd-may', postingDate: '2026-05-09', accountId: '2871', description: 'DOORDASH MERCHANT PAYOUT', amount: 1840, type: 'ACH_IN', merchant: 'DoorDash', category: 'INCOME', entityTag: 'DELICIOUS_BYTES', confirmedEntity: 'DELICIOUS_BYTES' },
  { key: 'gh-may', postingDate: '2026-05-13', accountId: '2871', description: 'GRUBHUB MERCHANT PAYOUT', amount: 1120, type: 'ACH_IN', merchant: 'Grubhub', category: 'INCOME', entityTag: 'DELICIOUS_BYTES', confirmedEntity: 'DELICIOUS_BYTES' },
  { key: 'sysco-may', postingDate: '2026-05-15', accountId: '2871', description: 'SYSCO FOOD SERVICE', amount: -680.20, type: 'ACH_OUT', merchant: 'Sysco', category: 'COGS', entityTag: 'DELICIOUS_BYTES', confirmedEntity: 'DELICIOUS_BYTES' },

  // --- Recent: a couple of subscriptions ---
  { key: 'notion-may', postingDate: '2026-05-17', accountId: '6562', description: 'NOTION LABS', amount: -20, type: 'CARD', merchant: 'Notion', category: 'SOFTWARE', entityTag: 'BYTES_AI', confirmedEntity: 'BYTES_AI' },
  { key: 'figma-may', postingDate: '2026-05-18', accountId: '6562', description: 'FIGMA', amount: -45, type: 'CARD', merchant: 'Figma', category: 'SOFTWARE', entityTag: 'BYTES_AI', confirmedEntity: 'BYTES_AI' },
];

function shouldSeed(db: Database.Database): boolean {
  if (process.env.SEED_DEMO_DATA !== 'true') return false;
  const row = db.prepare(`SELECT COUNT(*) AS c FROM transactions`).get() as { c: number };
  return row.c === 0;
}

export function seedDemoIfEmpty(db: Database.Database): { inserted: number; skipped: boolean } {
  if (!shouldSeed(db)) return { inserted: 0, skipped: true };

  const now = Date.now();
  const batchId = crypto.randomUUID();

  // Date range covered by the demo data.
  const dates = ROWS.map((r) => r.postingDate).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];

  db.prepare(`
    INSERT INTO import_batches (id, file_name, account_id, imported_at, row_count, date_range_from, date_range_to)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, 'demo-seed', '0320', now, ROWS.length, from, to);

  // Pre-allocate UUIDs keyed by row.key so we can resolve internal_linked_id refs.
  const ids = new Map<string, string>();
  for (const r of ROWS) ids.set(r.key, crypto.randomUUID());

  const insert = db.prepare(`
    INSERT INTO transactions (
      id, account_id, posting_date, description, amount, type, balance,
      merchant_name, category, entity_tag,
      is_internal, internal_linked_id,
      confirmed_entity, individual,
      audit_status, audit_flags, audit_score,
      imported_at, updated_at, import_batch_id, hash
    ) VALUES (
      @id, @accountId, @date, @description, @amount, @type, NULL,
      @merchant, @category, @entityTag,
      @isInternal, @internalLinkedId,
      @confirmedEntity, @individual,
      'UNREVIEWED', '[]', 0,
      @now, @now, @batchId, @hash
    )
  `);

  const txn = db.transaction(() => {
    for (const r of ROWS) {
      const id = ids.get(r.key)!;
      insert.run({
        id,
        accountId: r.accountId,
        date: r.postingDate,
        description: r.description,
        amount: r.amount,
        type: r.type,
        merchant: r.merchant,
        category: r.category,
        entityTag: r.entityTag,
        isInternal: r.isInternal ? 1 : 0,
        internalLinkedId: r.internalLink ? ids.get(r.internalLink) || null : null,
        confirmedEntity: r.confirmedEntity || null,
        individual: r.individual || null,
        now,
        batchId,
        hash: `demo:${id}`,
      });
    }
  });
  txn();

  return { inserted: ROWS.length, skipped: false };
}
