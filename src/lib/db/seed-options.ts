import 'server-only';
import { createOption, type OptionField } from './options';

/**
 * Default option values seeded into field_options on every getDb() call.
 * Idempotent via UNIQUE(field, value) + the createOption() upsert helper.
 *
 * Sub Category 1 acts as the "bucket" / parent category.
 * Sub Category 2 stores the specific item plus a parent_value pointer to its bucket.
 *
 * The drawer's Sub Category 2 dropdown filters to children of the chosen
 * Sub Category 1, with all OTHER categories visible below a separator
 * so cross-category picking is still one click away.
 */
const SIMPLE_DEFAULTS: Record<OptionField, string[]> = {
  individual: [],
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
  sub_category_1: [],   // filled by HIERARCHY below
  sub_category_2: [],   // filled by HIERARCHY below
};

/** Bucket -> specific items. Bucket name lives in sub_category_1; items in sub_category_2 with parent_value = bucket. */
const HIERARCHY: Record<string, string[]> = {
  'Salary': [
    'Base salary',
    'Bonus',
    'Commission',
    'Founder W-2 salary',
    'Founder draw',
    'Partner draw / distribution',
    'Guaranteed payment',
    'Contractor — 1099',
    'Payroll taxes',
    'Health insurance reimbursement',
    'Phone / car allowance',
    'Severance',
    'Back pay',
    'Reimbursement',
  ],
  'Software / SaaS': [
    'Slack', 'Notion', 'Figma', 'GitHub', 'Linear',
    'AWS', 'Vercel', 'Cloudflare',
    'Anthropic / Claude', 'OpenAI / ChatGPT',
    'Google Workspace', 'Microsoft 365', 'Adobe Creative Cloud',
    'Zoom', 'Loom', 'Intercom', 'HubSpot',
    'Stripe fees', 'Plaid', 'QuickBooks', 'Gusto',
    'Other software',
  ],
  'Office': [
    'Rent',
    'Supplies',
    'Equipment — computer',
    'Equipment — other',
    'Furniture',
    'Cleaning',
    'Coffee / snacks',
  ],
  'Utilities': [
    'Electricity',
    'Internet',
    'Phone',
    'Water',
    'Gas',
  ],
  'Travel': [
    'Airfare',
    'Hotel',
    'Rideshare (Uber / Lyft)',
    'Taxi',
    'Parking',
    'Car rental',
    'Train',
    'Meals while traveling',
    'Conference fees',
  ],
  'Meals & entertainment': [
    'Business meal',
    'Team meal',
    'Client meal',
    'Coffee meeting',
    'Event hosting',
    'Office party',
  ],
  'Marketing': [
    'Facebook Ads',
    'Google Ads',
    'TikTok Ads',
    'LinkedIn Ads',
    'Twitter / X Ads',
    'Agency fees',
    'Content production',
    'Events / sponsorships',
    'Swag / merch',
    'SEO tools',
    'Email marketing',
  ],
  'Professional services': [
    'Legal — general',
    'Legal — formation',
    'Legal — IP / trademark',
    'Accounting / Bookkeeping',
    'Tax prep',
    'Consulting',
    'Recruiting fees',
  ],
  'Insurance': [
    'General liability',
    'Health',
    'Auto',
    'Workers comp',
    'D&O',
    'Cyber',
  ],
  'COGS / Inventory': [
    'Food cost',
    'Packaging',
    'Raw materials',
    'Manufacturing',
    'Delivery / shipping',
    'Platform commission (DoorDash, Grubhub, Uber Eats)',
  ],
  'Banking & financial': [
    'Bank fees',
    'Wire fees',
    'ACH fees',
    'Credit card processing fees',
    'Interest expense',
    'Loan repayment — principal',
    'Loan repayment — interest',
    'Overdraft fee',
  ],
  'Taxes': [
    'Federal income tax',
    'State income tax',
    'Sales tax remittance',
    'Estimated quarterly tax',
    'Franchise / LLC fee',
    'Property tax',
  ],
  'Investment income': [
    'Cash contribution',
    'SAFE proceeds',
    'Equity round proceeds',
    'Convertible note proceeds',
    'Loan received',
    'Founder loan',
  ],
  'Revenue': [
    'Stripe',
    'DoorDash',
    'Grubhub',
    'Uber Eats',
    'TCETRA',
    'Vidapay',
    'Customer wire',
    'Customer Zelle',
    'Customer ACH',
    'Cash sales',
    'Refund received',
    'Interest income',
    'Other revenue',
  ],
  'Inter-entity': [
    'Transfer in (from sister entity)',
    'Transfer out (to sister entity)',
    'Passthrough — booked here, hits another entity',
    'Founder reimbursement',
    'Inter-entity loan',
  ],
  'Misc / one-off': [
    'Charitable donation',
    'Refund issued',
    'Personal — no deduct',
    'Gift to client',
    'Penalty / fine',
    'Settlement',
  ],
};

export function seedDefaultOptions(): void {
  // Simple flat fields
  for (const field of Object.keys(SIMPLE_DEFAULTS) as OptionField[]) {
    for (const v of SIMPLE_DEFAULTS[field]) {
      createOption(field, v);
    }
  }
  // Hierarchical sub_category_1 (buckets) and sub_category_2 (items)
  for (const bucket of Object.keys(HIERARCHY)) {
    createOption('sub_category_1', bucket);
    for (const item of HIERARCHY[bucket]) {
      createOption('sub_category_2', item, bucket);
    }
  }
}
