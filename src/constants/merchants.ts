import type { CategoryType, EntityType } from '@/types';

export interface MerchantRule {
  match: string[]; // substrings to test against UPPERCASE description
  merchantName: string;
  category: CategoryType;
  entityTag: EntityType;
  baseAuditScore?: number;
  auditFlags?: string[];
  suggestedPurpose: string;
}

// Order matters — first match wins. Put high-priority rules first.
export const EXPENSE_RULES: MerchantRule[] = [
  // ===== CRITICAL: International / risky wires =====
  {
    match: ['ABU DHABI ISLAMIC BANK'],
    merchantName: 'Abu Dhabi Islamic Bank (Egypt)',
    category: 'EXPENSE_WIRE_INTL',
    entityTag: 'UNKNOWN',
    baseAuditScore: 100,
    auditFlags: ['INTERNATIONAL_WIRE', 'IRS_REPORTABLE', 'NEEDS_DOCUMENTATION'],
    suggestedPurpose: 'CRITICAL: International wire — document recipient, purpose, and business justification',
  },
  {
    match: ['REMITLY'],
    merchantName: 'Remitly',
    category: 'EXPENSE_REMITTANCE',
    entityTag: 'UNKNOWN',
    baseAuditScore: 68,
    auditFlags: ['REMITTANCE', 'NEEDS_DOCUMENTATION'],
    suggestedPurpose: 'Remittance — document recipient and business purpose',
  },
  {
    match: ['WISE INC', 'WISE.COM', 'TRANSFERWISE'],
    merchantName: 'Wise',
    category: 'EXPENSE_REMITTANCE',
    entityTag: 'UNKNOWN',
    baseAuditScore: 68,
    auditFlags: ['REMITTANCE', 'NEEDS_DOCUMENTATION'],
    suggestedPurpose: 'Wise transfer — document recipient and business purpose',
  },

  // ===== Payroll (Bytes Restaurant Tech only) =====
  {
    match: ['GUSTO'],
    merchantName: 'Gusto',
    category: 'EXPENSE_PAYROLL',
    entityTag: 'BYTES_REST_TECH',
    baseAuditScore: 0,
    suggestedPurpose: 'Payroll run (Gusto)',
  },

  // ===== Processing fees (Rocket Wireless) =====
  {
    match: ['TRANSFIRST', 'TSYS'],
    merchantName: 'TransFirst/TSYS Processing',
    category: 'EXPENSE_PROCESSING_FEES',
    entityTag: 'ROCKET_WIRELESS',
    baseAuditScore: 0,
    suggestedPurpose: 'Card processing fees',
  },

  // ===== Food vendors (Delicious Bytes) =====
  {
    match: ['NYC APPLE DELI'],
    merchantName: 'NYC Apple Deli Corp',
    category: 'EXPENSE_COGS_FOOD',
    entityTag: 'DELICIOUS_BYTES',
    baseAuditScore: 0,
    suggestedPurpose: 'Food supplier — COGS',
  },
  {
    match: ['MR PIZZA MAN', 'MR. PIZZA MAN'],
    merchantName: 'Mr Pizza Man',
    category: 'EXPENSE_COGS_FOOD',
    entityTag: 'DELICIOUS_BYTES',
    baseAuditScore: 0,
    suggestedPurpose: 'Food supplier — COGS',
  },
  {
    match: ['FOOD HUB'],
    merchantName: 'Food Hub UK',
    category: 'EXPENSE_COGS_FOOD',
    entityTag: 'DELICIOUS_BYTES',
    baseAuditScore: 30,
    auditFlags: ['FX_DOCUMENTATION'],
    suggestedPurpose: 'Food Hub UK — verify FX documentation',
  },
  {
    match: ['KITCHENHUB', 'KITCHEN HUB'],
    merchantName: 'KitchenHub',
    category: 'EXPENSE_RENT',
    entityTag: 'DELICIOUS_BYTES',
    baseAuditScore: 0,
    suggestedPurpose: 'Ghost kitchen rent',
  },

  // ===== Bytes AI software stack =====
  {
    match: [
      'LIVEKIT', 'UPSTASH', 'SHIPDAY', 'BETTER STACK', 'BETTERSTACK', 'APIFY',
      'ANTHROPIC', 'CLAUDE.AI', 'OPENAI', 'TWILIO', 'TELNYX', 'VAPI', 'AIRCALL',
      'ANAM.AI', 'ANAM ', 'INTERCOM', 'ASANA', 'LINEAR APP', 'LINEAR.APP', 'CURSOR',
      'EXPO.DEV', '650 INDUSTRIES', 'TWINGATE', 'STREAMORDERS', 'CAL.COM',
      'GAMMA.APP', 'GAMMA APP', 'BLINQ', 'WEAVE', 'IDEOGRAM', 'CLUELY', 'FRAME.IO',
      'RINGCENTRAL', 'REDIS',
    ],
    merchantName: 'Bytes AI Software',
    category: 'EXPENSE_SOFTWARE_BYTES',
    entityTag: 'BYTES_AI',
    baseAuditScore: 0,
    suggestedPurpose: 'Software infrastructure — Bytes AI platform',
  },

  // ===== Marketing (Bytes AI) =====
  {
    match: ['FACEBOOK', 'FB ADS', 'META PLATFORMS', 'FACEBK'],
    merchantName: 'Facebook Ads (Meta)',
    category: 'EXPENSE_MARKETING',
    entityTag: 'BYTES_AI',
    baseAuditScore: 0,
    suggestedPurpose: 'Marketing / paid acquisition',
  },
  {
    match: ['LINKTREE'],
    merchantName: 'Linktree',
    category: 'EXPENSE_MARKETING',
    entityTag: 'BYTES_AI',
    baseAuditScore: 0,
    suggestedPurpose: 'Marketing — link in bio',
  },

  // ===== Business-shared software =====
  {
    match: ['AWS', 'AMAZON WEB SERVICES'],
    merchantName: 'AWS',
    category: 'EXPENSE_SOFTWARE_GENERAL',
    entityTag: 'BUSINESS_SHARED',
    baseAuditScore: 20,
    auditFlags: ['ALLOCATE_ACROSS_ENTITIES'],
    suggestedPurpose: 'Cloud hosting — allocate across entities',
  },
  {
    match: ['GOOGLE WORKSPACE', 'GOOGLE *GSUITE', 'GOOGLE *GOOGL', 'GOOGLE *GOOGLE'],
    merchantName: 'Google Workspace',
    category: 'EXPENSE_SOFTWARE_GENERAL',
    entityTag: 'BUSINESS_SHARED',
    baseAuditScore: 20,
    auditFlags: ['ALLOCATE_ACROSS_ENTITIES'],
    suggestedPurpose: 'Google Workspace — allocate across entities',
  },
  {
    match: ['ZOOM.US', 'ZOOM VIDEO'],
    merchantName: 'Zoom',
    category: 'EXPENSE_SOFTWARE_GENERAL',
    entityTag: 'BUSINESS_SHARED',
    baseAuditScore: 0,
    suggestedPurpose: 'Video conferencing',
  },

  // ===== Bank fees =====
  {
    match: ['OVERDRAFT FEE', 'OVERDRAFT PROTECT', 'INSUFFICIENT FUNDS FEE', 'SERVICE FEE', 'WIRE FEE', 'MONTHLY SERVICE FEE', 'FOREIGN EXCHANGE', 'NSF FEE', 'ODP FEE'],
    merchantName: 'Bank Fee',
    category: 'EXPENSE_BANK_FEES',
    entityTag: 'UNKNOWN',
    baseAuditScore: 5,
    suggestedPurpose: 'Bank fee',
  },

  // ===== Insurance =====
  {
    match: ['GEICO'],
    merchantName: 'GEICO',
    category: 'EXPENSE_INSURANCE',
    entityTag: 'PERSONAL',
    baseAuditScore: 25,
    auditFlags: ['CLASSIFY_PERSONAL_VS_BUSINESS'],
    suggestedPurpose: 'Insurance — classify personal vs business',
  },

  // ===== Travel =====
  {
    match: ['DELTA AIR', 'AMERICAN AIRLINES', 'UNITED AIRLINES', 'SOUTHWEST', 'JETBLUE', 'AIR CANADA', 'BRITISH AIRWAYS'],
    merchantName: 'Airline',
    category: 'EXPENSE_TRAVEL',
    entityTag: 'PERSONAL',
    baseAuditScore: 35,
    auditFlags: ['CLASSIFY_PERSONAL_VS_BUSINESS'],
    suggestedPurpose: 'Travel — confirm business purpose for deduction',
  },
  {
    match: ['HYATT', 'MARRIOTT', 'HILTON', 'AIRBNB', 'BOOKING.COM'],
    merchantName: 'Hotel/Lodging',
    category: 'EXPENSE_TRAVEL',
    entityTag: 'PERSONAL',
    baseAuditScore: 35,
    auditFlags: ['CLASSIFY_PERSONAL_VS_BUSINESS'],
    suggestedPurpose: 'Lodging — confirm business purpose',
  },

  // ===== Transport =====
  {
    match: ['UBER TRIP', 'UBER   *TRIP', 'LYFT'],
    merchantName: 'Rideshare',
    category: 'EXPENSE_TRANSPORT',
    entityTag: 'PERSONAL',
    baseAuditScore: 20,
    auditFlags: ['CLASSIFY_PERSONAL_VS_BUSINESS'],
    suggestedPurpose: 'Rideshare — business or personal?',
  },
  {
    match: ['SHELL OIL', 'CHEVRON', 'EXXON', 'MOBIL', '76 GAS', 'ARCO', 'CIRCLE K'],
    merchantName: 'Gas Station',
    category: 'EXPENSE_FUEL',
    entityTag: 'PERSONAL',
    baseAuditScore: 20,
    auditFlags: ['CLASSIFY_PERSONAL_VS_BUSINESS'],
    suggestedPurpose: 'Fuel — business or personal?',
  },

  // ===== Personal / clothing =====
  {
    match: ['H&M', 'SUIT SUPPLY', 'SUITSUPPLY', 'ZARA'],
    merchantName: 'Clothing',
    category: 'EXPENSE_PERSONAL',
    entityTag: 'PERSONAL',
    baseAuditScore: 10,
    suggestedPurpose: 'Personal clothing — not deductible',
  },
  {
    match: ['CVS/PHARMACY', 'CVS PHARMACY', 'WALGREENS'],
    merchantName: 'Pharmacy',
    category: 'EXPENSE_PERSONAL',
    entityTag: 'PERSONAL',
    baseAuditScore: 5,
    suggestedPurpose: 'Personal — pharmacy',
  },
  {
    match: ['HULU', 'NETFLIX', 'DISNEY+', 'SPOTIFY', 'APPLE.COM/BILL', 'APPLE STORE'],
    merchantName: 'Subscription',
    category: 'EXPENSE_PERSONAL',
    entityTag: 'PERSONAL',
    baseAuditScore: 5,
    suggestedPurpose: 'Personal subscription',
  },
  {
    match: ['HAAGEN', 'HAAGEN-DAZS'],
    merchantName: 'Haagen-Dazs',
    category: 'EXPENSE_FOOD_DINING',
    entityTag: 'PERSONAL',
    baseAuditScore: 5,
    suggestedPurpose: 'Personal dining',
  },
  {
    match: ['WAC BEVERLY HILLS', 'WAC BEVERLY'],
    merchantName: 'WAC Beverly Hills',
    category: 'EXPENSE_PERSONAL',
    entityTag: 'PERSONAL',
    baseAuditScore: 10,
    suggestedPurpose: 'Personal — not deductible',
  },

  // ===== Payment platforms =====
  {
    match: ['APPLE CASH'],
    merchantName: 'Apple Cash',
    category: 'EXPENSE_APPLE_CASH',
    entityTag: 'UNKNOWN',
    baseAuditScore: 50,
    auditFlags: ['UNCLASSIFIED_PAYMENT', 'NEEDS_RECIPIENT'],
    suggestedPurpose: 'Apple Cash — identify recipient and purpose',
  },
  {
    match: ['PAYPAL'],
    merchantName: 'PayPal',
    category: 'EXPENSE_PAYPAL',
    entityTag: 'UNKNOWN',
    baseAuditScore: 40,
    auditFlags: ['UNCLASSIFIED_PAYMENT', 'NEEDS_RECIPIENT'],
    suggestedPurpose: 'PayPal — identify recipient and purpose',
  },
  {
    match: ['CREDIT CARD PAYMENT', 'CRD CARD PMT', 'CHASE CREDIT CRD'],
    merchantName: 'Credit Card Payment',
    category: 'EXPENSE_CREDIT_CARD_PMT',
    entityTag: 'UNKNOWN',
    baseAuditScore: 25,
    auditFlags: ['CREDIT_CARD_PAYMENT'],
    suggestedPurpose: 'Credit card payment — reconcile against card statement',
  },
];

// Income detection rules (positive amounts)
export interface IncomeRule {
  match: string[];
  merchantName: string;
  category: CategoryType;
  entityTag: EntityType;
  incomeSource: import('@/types').IncomeSourceType;
  baseAuditScore?: number;
  auditFlags?: string[];
  suggestedPurpose: string;
}

export const INCOME_RULES: IncomeRule[] = [
  {
    match: ['SPACETEL'],
    merchantName: 'Spacetel LLC',
    category: 'INCOME_WIRE',
    entityTag: 'AMARI_VENTURES',
    incomeSource: 'SPACETEL',
    baseAuditScore: 20,
    auditFlags: ['CONFIRM_ENTITY_TAG'],
    suggestedPurpose: 'Spacetel LLC wire — confirm which entity this revenue belongs to',
  },
  {
    match: ['OMAR M ALGHAZALI', 'OMAR ALGHAZALI'],
    merchantName: 'Omar M Alghazali (Spacetel?)',
    category: 'INCOME_WIRE',
    entityTag: 'AMARI_VENTURES',
    incomeSource: 'OMAR_ALGHAZALI',
    baseAuditScore: 60,
    auditFlags: ['CONFIRM_SAME_AS_SPACETEL'],
    suggestedPurpose: 'CHIPS wire — Fresno CA 93722, same address as Spacetel. Confirm if same entity.',
  },
  {
    match: ['TCETRA'],
    merchantName: 'TCETRA',
    category: 'INCOME_TCETRA',
    entityTag: 'ROCKET_WIRELESS',
    incomeSource: 'TCETRA',
    baseAuditScore: 0,
    suggestedPurpose: 'Carrier commission payout',
  },
  {
    match: ['VIDAPAY'],
    merchantName: 'Vidapay',
    category: 'INCOME_TCETRA',
    entityTag: 'ROCKET_WIRELESS',
    incomeSource: 'VIDAPAY',
    baseAuditScore: 0,
    suggestedPurpose: 'Carrier commission payout (Vidapay)',
  },
  {
    match: ['STRIPE'],
    merchantName: 'Stripe',
    category: 'INCOME_STRIPE',
    entityTag: 'BYTES_AI',
    incomeSource: 'STRIPE',
    baseAuditScore: 0,
    suggestedPurpose: 'SaaS platform revenue',
  },
  {
    match: ['DOORDASH'],
    merchantName: 'DoorDash',
    category: 'INCOME_DOORDASH',
    entityTag: 'DELICIOUS_BYTES',
    incomeSource: 'DOORDASH',
    baseAuditScore: 0,
    suggestedPurpose: 'Ghost kitchen sales — DoorDash',
  },
  {
    match: ['GRUBHUB'],
    merchantName: 'Grubhub',
    category: 'INCOME_GRUBHUB',
    entityTag: 'DELICIOUS_BYTES',
    incomeSource: 'GRUBHUB',
    baseAuditScore: 0,
    suggestedPurpose: 'Ghost kitchen sales — Grubhub',
  },
  {
    match: ['UBER EAT', 'UBEREATS'],
    merchantName: 'Uber Eats',
    category: 'INCOME_UBEREATS',
    entityTag: 'DELICIOUS_BYTES',
    incomeSource: 'UBER_EATS',
    baseAuditScore: 20,
    auditFlags: ['CONFIRM_ENTITY_TAG'],
    suggestedPurpose: 'Uber Eats — confirm Bytes AI vs Delicious Bytes',
  },
  {
    match: ['GUSTO'],
    merchantName: 'Gusto Refund',
    category: 'INCOME_OTHER',
    entityTag: 'BYTES_REST_TECH',
    incomeSource: 'GUSTO',
    baseAuditScore: 10,
    suggestedPurpose: 'Gusto refund / true-up',
  },
];
