/**
 * Preset catalog of custom category names + descriptions, embedded in
 * the code so the '+ Custom' input autocomplete has suggestions from
 * the very first row — no dependency on prior usage.
 *
 * These are merged with the live DB suggestions
 * (see listCustomCategorySuggestions in queries.ts) so users see BOTH
 * the presets AND anything they've typed before, ranked by usage.
 *
 * Add / edit freely — the shape is deliberately simple.
 */

export type CustomCategoryPath = 'BUSINESS' | 'PERSONAL';

export interface CustomCategoryPreset {
  name: string;
  description: string;
  /** Which top-level path this preset belongs to — the '+ Custom' dropdown
   *  filters by this so a user tagging a Business row doesn't see personal
   *  buckets and vice versa. */
  path: CustomCategoryPath;
}

// ══════════════════════════════════════════════════════════════════════
//   BUSINESS categories — legal, tax, SaaS, marketing, HR, office, etc.
// ══════════════════════════════════════════════════════════════════════
const BUSINESS_PRESETS: CustomCategoryPreset[] = [
  // ── Legal / regulatory ─────────────────────────────────────────────
  { path: 'BUSINESS', name: 'Legal — Delaware filings',      description: 'Delaware LLC / C-corp annual reports, registered agent fees, franchise tax' },
  { path: 'BUSINESS', name: 'Legal — Trademark & IP',        description: 'USPTO filings, trademark attorneys, patent work' },
  { path: 'BUSINESS', name: 'Legal — Contract review',       description: 'Attorney fees for reviewing customer / vendor / employment contracts' },
  { path: 'BUSINESS', name: 'Legal — Immigration',           description: 'H-1B, O-1, EB-1 visa or green-card work' },
  { path: 'BUSINESS', name: 'Legal — Corporate structuring', description: 'S-corp elections, holding-company setup, entity restructuring' },

  // ── Tax / accounting ───────────────────────────────────────────────
  { path: 'BUSINESS', name: 'Tax — CPA prep',                description: 'Annual tax preparation, quarterly estimates, bookkeeping cleanup' },
  { path: 'BUSINESS', name: 'Tax — Sales tax filing',        description: 'State sales-tax filings, Avalara / TaxJar / third-party services' },
  { path: 'BUSINESS', name: 'Tax — Payroll tax',             description: 'Federal + state payroll deposits, 940 / 941 / W-2 / 1099 work' },
  { path: 'BUSINESS', name: 'Tax — Franchise tax',           description: 'Delaware franchise tax, California minimum tax, other state annuals' },

  // ── Software / infrastructure ─────────────────────────────────────
  { path: 'BUSINESS', name: 'SaaS — Development tools',      description: 'GitHub, Linear, Notion, Figma, other dev productivity subscriptions' },
  { path: 'BUSINESS', name: 'SaaS — Infrastructure',         description: 'AWS, GCP, Vercel, Railway, Cloudflare, monitoring, CDN' },
  { path: 'BUSINESS', name: 'SaaS — AI APIs',                description: 'Anthropic, OpenAI, other LLM / AI service usage' },
  { path: 'BUSINESS', name: 'SaaS — Communication',          description: 'Slack, Zoom, email, calendar, phone / SMS services' },
  { path: 'BUSINESS', name: 'SaaS — CRM / support',          description: 'Intercom, HubSpot, Zendesk, Salesforce, customer-facing tools' },
  { path: 'BUSINESS', name: 'SaaS — Analytics',              description: 'PostHog, Amplitude, Mixpanel, Segment, GA' },

  // ── Marketing / growth ────────────────────────────────────────────
  { path: 'BUSINESS', name: 'Marketing — Paid ads',          description: 'Google Ads, Meta / Facebook Ads, TikTok, LinkedIn ads' },
  { path: 'BUSINESS', name: 'Marketing — Content',           description: 'Freelance writers, video editing, podcast production' },
  { path: 'BUSINESS', name: 'Marketing — Events',            description: 'Conference booths, sponsorships, hosted events' },
  { path: 'BUSINESS', name: 'Marketing — PR',                description: 'Press releases, PR firms, influencer partnerships' },
  { path: 'BUSINESS', name: 'Marketing — SEO / tools',       description: 'Ahrefs, SEMrush, Screaming Frog, content SEO subscriptions' },

  // ── People operations ─────────────────────────────────────────────
  { path: 'BUSINESS', name: 'HR — Payroll platform',         description: 'Gusto, Rippling, ADP, Justworks — the platform fee itself, not wages' },
  { path: 'BUSINESS', name: 'HR — Benefits',                 description: 'Health insurance premiums, 401(k) admin, employee perks stipend' },
  { path: 'BUSINESS', name: 'HR — Recruiting',               description: 'Job boards (LinkedIn, Otta), sourcing services, recruiter fees' },
  { path: 'BUSINESS', name: 'HR — Training',                 description: 'Courses, certifications, conferences for team members' },
  { path: 'BUSINESS', name: 'HR — Team offsite',             description: 'Retreat travel + lodging + meals for team gatherings' },

  // ── Office / operations ───────────────────────────────────────────
  { path: 'BUSINESS', name: 'Office — Coworking',            description: 'WeWork, Regus, private day-passes, satellite office space' },
  { path: 'BUSINESS', name: 'Office — Supplies',             description: 'Amazon office orders, hardware refresh, whiteboard supplies' },
  { path: 'BUSINESS', name: 'Office — Utilities',            description: 'Internet, electric, water for a company office' },
  { path: 'BUSINESS', name: 'Office — Rent',                 description: 'Monthly lease payments for a physical office' },

  // ── Travel / expenses ─────────────────────────────────────────────
  { path: 'BUSINESS', name: 'Travel — Client meetings',      description: 'Flights, hotels, ground transport specifically for a client visit' },
  { path: 'BUSINESS', name: 'Travel — Conference',           description: 'Travel + registration for industry conferences' },
  { path: 'BUSINESS', name: 'Travel — Team offsite',         description: 'Retreat travel booked for multiple team members at once' },
  { path: 'BUSINESS', name: 'Meals — Client entertainment',  description: 'Meals with clients / prospects — 50% deductible' },
  { path: 'BUSINESS', name: 'Meals — Team',                  description: 'Team lunches, working dinners, meals with contractors' },
  { path: 'BUSINESS', name: 'Meals — Hotel convenience store', description: 'Snacks / drinks / small food from hotel mini-marts on business travel — travel-meal deductible' },
  { path: 'BUSINESS', name: 'Meals — Airport / travel',      description: 'Meals + snacks at airports, gas station stops during business travel' },

  // ── Investment / financial ────────────────────────────────────────
  { path: 'BUSINESS', name: 'Financial — Bank fees',         description: 'Wire fees, overdraft, monthly account fees, incoming ACH fees' },
  { path: 'BUSINESS', name: 'Financial — Stripe fees',       description: 'Processing fees on inbound Stripe income (2.9%+30¢, dispute fees)' },
  { path: 'BUSINESS', name: 'Financial — Investment mgmt',   description: 'Wealth-management fees, treasury / brokerage account management' },
  { path: 'BUSINESS', name: 'Financial — Refunds paid',      description: 'Refunds sent to customers — offsetting revenue' },

  // ── Investor / fundraising ────────────────────────────────────────
  { path: 'BUSINESS', name: 'Investor — Dataroom / diligence', description: 'Data-room platforms, financial-modeling tools shared with investors' },
  { path: 'BUSINESS', name: 'Investor — Fundraising legal',    description: 'SAFE / priced-round legal work, cap-table tools like Carta' },

  // ── One-off / project ─────────────────────────────────────────────
  { path: 'BUSINESS', name: 'Project — R&D prototype',       description: 'One-off hardware / materials for a specific prototype' },
  { path: 'BUSINESS', name: 'Project — Client-specific',     description: 'Costs directly attributable to one customer contract' },
];

// ══════════════════════════════════════════════════════════════════════
//   PERSONAL categories — day-to-day non-business spending
// ══════════════════════════════════════════════════════════════════════
const PERSONAL_PRESETS: CustomCategoryPreset[] = [
  // ── Shopping ──────────────────────────────────────────────────────
  { path: 'PERSONAL', name: 'Shopping — Clothes',            description: 'Apparel, shoes, accessories from any store or online' },
  { path: 'PERSONAL', name: 'Shopping — Electronics',        description: 'Phones, laptops, headphones, personal tech' },
  { path: 'PERSONAL', name: 'Shopping — Home goods',         description: 'Furniture, appliances, decor, kitchen equipment' },
  { path: 'PERSONAL', name: 'Shopping — Amazon (general)',   description: 'Miscellaneous Amazon orders that don’t fit another bucket' },
  { path: 'PERSONAL', name: 'Shopping — Gifts',              description: 'Presents for family, friends, birthdays, holidays' },
  { path: 'PERSONAL', name: 'Shopping — Books / media',      description: 'Books, ebooks, music, movies, streaming purchases' },

  // ── Food & dining ─────────────────────────────────────────────────
  { path: 'PERSONAL', name: 'Food — Groceries',              description: 'Whole Foods, Trader Joe’s, supermarkets, produce' },
  { path: 'PERSONAL', name: 'Food — Restaurants',            description: 'Dining out — lunch, dinner, casual and fine' },
  { path: 'PERSONAL', name: 'Food — Coffee / cafes',         description: 'Coffee shops, tea, cafes, morning coffee runs' },
  { path: 'PERSONAL', name: 'Food — Fast food / takeout',    description: 'Quick service, drive-through, delivery apps for yourself' },
  { path: 'PERSONAL', name: 'Food — Alcohol / bars',         description: 'Bars, liquor stores, wine, cocktails' },
  { path: 'PERSONAL', name: 'Food — Hotel convenience store', description: 'Snacks, drinks, small food purchases from hotel mini-marts or lobby stores while traveling' },
  { path: 'PERSONAL', name: 'Food — Airport / travel',       description: 'Meals and snacks at airports, train stations, gas station convenience stores while traveling' },

  // ── Transportation (personal) ────────────────────────────────────
  { path: 'PERSONAL', name: 'Personal — Uber / Lyft',        description: 'Rideshares for personal use (not client travel)' },
  { path: 'PERSONAL', name: 'Personal — Gas / fuel',         description: 'Gas station fill-ups for personal vehicle' },
  { path: 'PERSONAL', name: 'Personal — Public transit',     description: 'Subway, bus, commuter rail, MetroCard' },
  { path: 'PERSONAL', name: 'Personal — Parking / tolls',    description: 'Parking meters, garages, bridge & highway tolls' },
  { path: 'PERSONAL', name: 'Personal — Car maintenance',    description: 'Oil changes, tires, repairs, DMV, registration' },

  // ── Housing (personal) ────────────────────────────────────────────
  { path: 'PERSONAL', name: 'Housing — Rent',                description: 'Monthly rent to landlord' },
  { path: 'PERSONAL', name: 'Housing — Mortgage',            description: 'Mortgage principal + interest payments' },
  { path: 'PERSONAL', name: 'Housing — Utilities',           description: 'Electric, gas, water for your home' },
  { path: 'PERSONAL', name: 'Housing — Internet / cable',    description: 'Home broadband, cable TV subscriptions' },
  { path: 'PERSONAL', name: 'Housing — Repairs',             description: 'Home repairs, plumber, handyman, painting' },
  { path: 'PERSONAL', name: 'Housing — Insurance',           description: 'Renter’s or homeowner’s insurance' },

  // ── Health & wellness ────────────────────────────────────────────
  { path: 'PERSONAL', name: 'Health — Gym / fitness',        description: 'Gym memberships, fitness classes, personal trainer' },
  { path: 'PERSONAL', name: 'Health — Doctor / medical',     description: 'Copays, specialist visits, prescriptions' },
  { path: 'PERSONAL', name: 'Health — Dental / vision',      description: 'Dentist, optometrist, contacts, glasses' },
  { path: 'PERSONAL', name: 'Health — Mental health',        description: 'Therapy, coaching, mental health apps' },
  { path: 'PERSONAL', name: 'Health — Supplements / pharmacy', description: 'Vitamins, over-the-counter meds, wellness products' },

  // ── Entertainment / leisure ───────────────────────────────────────
  { path: 'PERSONAL', name: 'Entertainment — Streaming',     description: 'Netflix, Spotify, Apple TV+, HBO, Disney+' },
  { path: 'PERSONAL', name: 'Entertainment — Movies / shows',description: 'Movie tickets, theater, concerts, live shows' },
  { path: 'PERSONAL', name: 'Entertainment — Hobbies',       description: 'Sports equipment, art supplies, hobby gear' },
  { path: 'PERSONAL', name: 'Entertainment — Games',         description: 'Video games, in-app purchases, gaming subscriptions' },
  { path: 'PERSONAL', name: 'Entertainment — Events',        description: 'Concerts, sports tickets, festivals' },

  // ── Personal services ────────────────────────────────────────────
  { path: 'PERSONAL', name: 'Personal — Haircut / grooming', description: 'Barber, hair salon, nails, spa' },
  { path: 'PERSONAL', name: 'Personal — Laundry / dry cleaning', description: 'Wash-and-fold, dry cleaner, alterations' },
  { path: 'PERSONAL', name: 'Personal — Cleaning service',   description: 'House cleaner, maid service' },
  { path: 'PERSONAL', name: 'Personal — Subscriptions',      description: 'Personal software (iCloud, YouTube Premium, etc.), non-work' },

  // ── Family / relationships ──────────────────────────────────────
  { path: 'PERSONAL', name: 'Family — Kids',                 description: 'Kid-related spending: school, activities, clothes, toys' },
  { path: 'PERSONAL', name: 'Family — Pets',                 description: 'Pet food, vet, grooming, boarding' },
  { path: 'PERSONAL', name: 'Family — Charity / giving',     description: 'Donations, gifts to causes, religious contributions' },
  { path: 'PERSONAL', name: 'Family — Support / remittance', description: 'Sending money to family members' },

  // ── Personal travel ──────────────────────────────────────────────
  { path: 'PERSONAL', name: 'Personal travel — Flights',     description: 'Vacation / personal flights (not for work)' },
  { path: 'PERSONAL', name: 'Personal travel — Lodging',     description: 'Hotels, Airbnb, vacation rentals for personal trips' },
  { path: 'PERSONAL', name: 'Personal travel — Activities',  description: 'Excursions, tours, tickets during vacation' },

  // ── Miscellaneous personal ──────────────────────────────────────
  { path: 'PERSONAL', name: 'Personal — Cash withdrawal',    description: 'ATM withdrawals — where the cash went is manual' },
  { path: 'PERSONAL', name: 'Personal — Fees',               description: 'Late fees, ATM fees on personal accounts' },
  { path: 'PERSONAL', name: 'Personal — Other',              description: 'Personal spending that doesn’t fit anywhere else' },
];

/** Combined catalog — the '+ Custom' input filters this by path so the
 *  user only sees the categories that make sense for the row they're
 *  tagging. */
export const CUSTOM_CATEGORY_PRESETS: CustomCategoryPreset[] = [
  ...BUSINESS_PRESETS,
  ...PERSONAL_PRESETS,
];
