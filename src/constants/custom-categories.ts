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
];
