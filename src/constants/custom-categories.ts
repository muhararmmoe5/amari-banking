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

export interface CustomCategoryPreset {
  name: string;
  description: string;
}

export const CUSTOM_CATEGORY_PRESETS: CustomCategoryPreset[] = [
  // ── Legal / regulatory ─────────────────────────────────────────────
  { name: 'Legal — Delaware filings',      description: 'Delaware LLC / C-corp annual reports, registered agent fees, franchise tax' },
  { name: 'Legal — Trademark & IP',        description: 'USPTO filings, trademark attorneys, patent work' },
  { name: 'Legal — Contract review',       description: 'Attorney fees for reviewing customer / vendor / employment contracts' },
  { name: 'Legal — Immigration',           description: 'H-1B, O-1, EB-1 visa or green-card work' },
  { name: 'Legal — Corporate structuring', description: 'S-corp elections, holding-company setup, entity restructuring' },

  // ── Tax / accounting ───────────────────────────────────────────────
  { name: 'Tax — CPA prep',                description: 'Annual tax preparation, quarterly estimates, bookkeeping cleanup' },
  { name: 'Tax — Sales tax filing',        description: 'State sales-tax filings, Avalara / TaxJar / third-party services' },
  { name: 'Tax — Payroll tax',             description: 'Federal + state payroll deposits, 940 / 941 / W-2 / 1099 work' },
  { name: 'Tax — Franchise tax',           description: 'Delaware franchise tax, California minimum tax, other state annuals' },

  // ── Software / infrastructure ─────────────────────────────────────
  { name: 'SaaS — Development tools',      description: 'GitHub, Linear, Notion, Figma, other dev productivity subscriptions' },
  { name: 'SaaS — Infrastructure',         description: 'AWS, GCP, Vercel, Railway, Cloudflare, monitoring, CDN' },
  { name: 'SaaS — AI APIs',                description: 'Anthropic, OpenAI, other LLM / AI service usage' },
  { name: 'SaaS — Communication',          description: 'Slack, Zoom, email, calendar, phone / SMS services' },
  { name: 'SaaS — CRM / support',          description: 'Intercom, HubSpot, Zendesk, Salesforce, customer-facing tools' },
  { name: 'SaaS — Analytics',              description: 'PostHog, Amplitude, Mixpanel, Segment, GA' },

  // ── Marketing / growth ────────────────────────────────────────────
  { name: 'Marketing — Paid ads',          description: 'Google Ads, Meta / Facebook Ads, TikTok, LinkedIn ads' },
  { name: 'Marketing — Content',           description: 'Freelance writers, video editing, podcast production' },
  { name: 'Marketing — Events',            description: 'Conference booths, sponsorships, hosted events' },
  { name: 'Marketing — PR',                description: 'Press releases, PR firms, influencer partnerships' },
  { name: 'Marketing — SEO / tools',       description: 'Ahrefs, SEMrush, Screaming Frog, content SEO subscriptions' },

  // ── People operations ─────────────────────────────────────────────
  { name: 'HR — Payroll platform',         description: 'Gusto, Rippling, ADP, Justworks — the platform fee itself, not wages' },
  { name: 'HR — Benefits',                 description: 'Health insurance premiums, 401(k) admin, employee perks stipend' },
  { name: 'HR — Recruiting',               description: 'Job boards (LinkedIn, Otta), sourcing services, recruiter fees' },
  { name: 'HR — Training',                 description: 'Courses, certifications, conferences for team members' },
  { name: 'HR — Team offsite',             description: 'Retreat travel + lodging + meals for team gatherings' },

  // ── Office / operations ───────────────────────────────────────────
  { name: 'Office — Coworking',            description: 'WeWork, Regus, private day-passes, satellite office space' },
  { name: 'Office — Supplies',             description: 'Amazon office orders, hardware refresh, whiteboard supplies' },
  { name: 'Office — Utilities',            description: 'Internet, electric, water for a company office' },
  { name: 'Office — Rent',                 description: 'Monthly lease payments for a physical office' },

  // ── Travel / expenses ─────────────────────────────────────────────
  { name: 'Travel — Client meetings',      description: 'Flights, hotels, ground transport specifically for a client visit' },
  { name: 'Travel — Conference',           description: 'Travel + registration for industry conferences' },
  { name: 'Travel — Team offsite',         description: 'Retreat travel booked for multiple team members at once' },
  { name: 'Meals — Client entertainment',  description: 'Meals with clients / prospects — 50% deductible' },
  { name: 'Meals — Team',                  description: 'Team lunches, working dinners, meals with contractors' },

  // ── Investment / financial ────────────────────────────────────────
  { name: 'Financial — Bank fees',         description: 'Wire fees, overdraft, monthly account fees, incoming ACH fees' },
  { name: 'Financial — Stripe fees',       description: 'Processing fees on inbound Stripe income (2.9%+30¢, dispute fees)' },
  { name: 'Financial — Investment mgmt',   description: 'Wealth-management fees, treasury / brokerage account management' },
  { name: 'Financial — Refunds paid',      description: 'Refunds sent to customers — offsetting revenue' },

  // ── Investor / fundraising ────────────────────────────────────────
  { name: 'Investor — Dataroom / diligence', description: 'Data-room platforms, financial-modeling tools shared with investors' },
  { name: 'Investor — Fundraising legal',    description: 'SAFE / priced-round legal work, cap-table tools like Carta' },

  // ── One-off / project ─────────────────────────────────────────────
  { name: 'Project — R&D prototype',       description: 'One-off hardware / materials for a specific prototype' },
  { name: 'Project — Client-specific',     description: 'Costs directly attributable to one customer contract' },

  // ══════════════════════════════════════════════════════════════════
  //   PERSONAL — day-to-day non-business spending
  // ══════════════════════════════════════════════════════════════════

  // ── Shopping ──────────────────────────────────────────────────────
  { name: 'Shopping — Clothes',            description: 'Apparel, shoes, accessories from any store or online' },
  { name: 'Shopping — Electronics',        description: 'Phones, laptops, headphones, personal tech' },
  { name: 'Shopping — Home goods',         description: 'Furniture, appliances, decor, kitchen equipment' },
  { name: 'Shopping — Amazon (general)',   description: 'Miscellaneous Amazon orders that don’t fit another bucket' },
  { name: 'Shopping — Gifts',              description: 'Presents for family, friends, birthdays, holidays' },
  { name: 'Shopping — Books / media',      description: 'Books, ebooks, music, movies, streaming purchases' },

  // ── Food & dining ─────────────────────────────────────────────────
  { name: 'Food — Groceries',              description: 'Whole Foods, Trader Joe’s, supermarkets, produce' },
  { name: 'Food — Restaurants',            description: 'Dining out — lunch, dinner, casual and fine' },
  { name: 'Food — Coffee / cafes',         description: 'Coffee shops, tea, cafes, morning coffee runs' },
  { name: 'Food — Fast food / takeout',    description: 'Quick service, drive-through, delivery apps for yourself' },
  { name: 'Food — Alcohol / bars',         description: 'Bars, liquor stores, wine, cocktails' },

  // ── Transportation (personal) ────────────────────────────────────
  { name: 'Personal — Uber / Lyft',        description: 'Rideshares for personal use (not client travel)' },
  { name: 'Personal — Gas / fuel',         description: 'Gas station fill-ups for personal vehicle' },
  { name: 'Personal — Public transit',     description: 'Subway, bus, commuter rail, MetroCard' },
  { name: 'Personal — Parking / tolls',    description: 'Parking meters, garages, bridge & highway tolls' },
  { name: 'Personal — Car maintenance',    description: 'Oil changes, tires, repairs, DMV, registration' },

  // ── Housing (personal) ────────────────────────────────────────────
  { name: 'Housing — Rent',                description: 'Monthly rent to landlord' },
  { name: 'Housing — Mortgage',            description: 'Mortgage principal + interest payments' },
  { name: 'Housing — Utilities',           description: 'Electric, gas, water for your home' },
  { name: 'Housing — Internet / cable',    description: 'Home broadband, cable TV subscriptions' },
  { name: 'Housing — Repairs',             description: 'Home repairs, plumber, handyman, painting' },
  { name: 'Housing — Insurance',           description: 'Renter’s or homeowner’s insurance' },

  // ── Health & wellness ────────────────────────────────────────────
  { name: 'Health — Gym / fitness',        description: 'Gym memberships, fitness classes, personal trainer' },
  { name: 'Health — Doctor / medical',     description: 'Copays, specialist visits, prescriptions' },
  { name: 'Health — Dental / vision',      description: 'Dentist, optometrist, contacts, glasses' },
  { name: 'Health — Mental health',        description: 'Therapy, coaching, mental health apps' },
  { name: 'Health — Supplements / pharmacy', description: 'Vitamins, over-the-counter meds, wellness products' },

  // ── Entertainment / leisure ───────────────────────────────────────
  { name: 'Entertainment — Streaming',     description: 'Netflix, Spotify, Apple TV+, HBO, Disney+' },
  { name: 'Entertainment — Movies / shows',description: 'Movie tickets, theater, concerts, live shows' },
  { name: 'Entertainment — Hobbies',       description: 'Sports equipment, art supplies, hobby gear' },
  { name: 'Entertainment — Games',         description: 'Video games, in-app purchases, gaming subscriptions' },
  { name: 'Entertainment — Events',        description: 'Concerts, sports tickets, festivals' },

  // ── Personal services ────────────────────────────────────────────
  { name: 'Personal — Haircut / grooming', description: 'Barber, hair salon, nails, spa' },
  { name: 'Personal — Laundry / dry cleaning', description: 'Wash-and-fold, dry cleaner, alterations' },
  { name: 'Personal — Cleaning service',   description: 'House cleaner, maid service' },
  { name: 'Personal — Subscriptions',      description: 'Personal software (iCloud, YouTube Premium, etc.), non-work' },

  // ── Family / relationships ──────────────────────────────────────
  { name: 'Family — Kids',                 description: 'Kid-related spending: school, activities, clothes, toys' },
  { name: 'Family — Pets',                 description: 'Pet food, vet, grooming, boarding' },
  { name: 'Family — Charity / giving',     description: 'Donations, gifts to causes, religious contributions' },
  { name: 'Family — Support / remittance', description: 'Sending money to family members' },

  // ── Personal travel ──────────────────────────────────────────────
  { name: 'Personal travel — Flights',     description: 'Vacation / personal flights (not for work)' },
  { name: 'Personal travel — Lodging',     description: 'Hotels, Airbnb, vacation rentals for personal trips' },
  { name: 'Personal travel — Activities',  description: 'Excursions, tours, tickets during vacation' },

  // ── Miscellaneous personal ──────────────────────────────────────
  { name: 'Personal — Cash withdrawal',    description: 'ATM withdrawals — where the cash went is manual' },
  { name: 'Personal — Fees',               description: 'Late fees, ATM fees on personal accounts' },
  { name: 'Personal — Other',              description: 'Personal spending that doesn’t fit anywhere else' },
];
