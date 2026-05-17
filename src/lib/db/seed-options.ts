import 'server-only';
import { createOption, type OptionField } from './options';

/**
 * Default option values that get seeded once into the field_options table.
 * Idempotent via the UNIQUE(field, value) constraint with ON CONFLICT IGNORE
 * on the table, so re-running is safe and never overwrites user customizations.
 */
const DEFAULTS: Record<OptionField, string[]> = {
  individual: [],

  sub_category_1: [
    // Software / Ops
    'Software / SaaS',
    'Office rent',
    'Office supplies',
    'Office equipment',
    'Utilities — electricity',
    'Utilities — internet',
    'Utilities — phone',
    'Subscriptions',
    'Education / Training',
    'Equipment — computer',
    'Equipment — other',
    'Repairs & maintenance',
    // Travel & meals
    'Travel — airfare',
    'Travel — hotel',
    'Travel — rideshare / taxi',
    'Travel — parking',
    'Travel — meals',
    'Meals — business',
    'Meals — team',
    // Marketing
    'Marketing — ads',
    'Marketing — content',
    'Marketing — events',
    'Marketing — agency fees',
    // Professional services
    'Legal fees',
    'Accounting / Bookkeeping',
    'Consulting',
    'Insurance — general liability',
    'Insurance — health',
    'Insurance — auto',
    // Payroll & people
    'Salary — base',
    'Salary — bonus',
    'Founder salary — W-2',
    'Founder draw',
    'Partner draw / distribution',
    'Guaranteed payment',
    'Contractor — 1099',
    'Payroll taxes',
    'Health insurance reimbursement',
    'Phone / car allowance',
    // Cost of goods sold
    'Inventory / COGS',
    'Food cost',
    'Packaging / materials',
    'Delivery / shipping',
    // Financial
    'Bank fees',
    'Wire fees',
    'Interest expense',
    'Loan repayment',
    'Credit card fees',
    // Taxes
    'Income taxes — federal',
    'Income taxes — state',
    'Sales tax remittance',
    'Estimated taxes',
    // Income
    'Revenue — Stripe',
    'Revenue — DoorDash',
    'Revenue — Grubhub',
    'Revenue — Uber Eats',
    'Revenue — TCETRA',
    'Revenue — Vidapay',
    'Revenue — customer wire',
    'Revenue — customer Zelle',
    'Investment — cash contribution',
    'Investment — SAFE',
    'Loan received',
    'Refund received',
    'Interest income',
    // Misc
    'Charitable donation',
    'Refund issued',
    'Owner reimbursement',
    'Inter-entity transfer',
    'Personal — no deduct',
  ],

  sub_category_2: [
    // Common SaaS
    'Slack', 'Notion', 'Figma', 'GitHub', 'Linear', 'AWS', 'Vercel',
    'Anthropic / Claude', 'OpenAI / ChatGPT', 'Google Workspace',
    'Microsoft 365', 'Adobe Creative Cloud', 'Zoom', 'Loom', 'Intercom',
    'HubSpot', 'Stripe fees', 'Plaid', 'QuickBooks', 'Gusto',
    // Marketing-specific
    'Facebook Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads',
    // Delivery/food specific
    'DoorDash commission', 'Grubhub commission', 'Uber Eats commission',
    // Transportation
    'Uber', 'Lyft', 'Airbnb', 'Hotel',
  ],

  business_purpose: [
    'Customer acquisition',
    'Product development',
    'Tools / productivity',
    'Day-to-day operations',
    'Compliance / regulatory',
    'Tax preparation',
    'Team morale / off-site',
    'Investor relations',
    'Founder development',
    'Office build-out',
    'R&D — experimentation',
    'Pre-revenue research',
    'Legal — formation',
    'Legal — contract review',
    'Legal — IP / trademark',
    'Closing a deal',
    'Recurring overhead',
    'One-off vendor payment',
    'Inter-entity passthrough',
    'Personal — not deductible',
  ],

  source_of_money: [
    // Money pools will mostly be auto-generated from entities + commitments,
    // but include a few free-form catches here.
    'Pre-import balance',
    'Personal funds',
    'Credit card float',
  ],

  need_to_get_from: [
    'Customer',
    'Vendor refund pending',
    'Insurance claim',
    'Reimbursement from partner',
    'Pre-import balance',
  ],
};

export function seedDefaultOptions(): void {
  for (const field of Object.keys(DEFAULTS) as OptionField[]) {
    for (const v of DEFAULTS[field]) {
      createOption(field, v);
    }
  }
}
