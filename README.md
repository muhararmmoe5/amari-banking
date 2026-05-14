# Amari Banking — Reconciliation Tool

A multi-entity financial reconciliation and audit-trail tool for Amari Ventures LLC. Imports Chase CSV exports, auto-categorizes every transaction, tags entities, flags audit risk, and generates a CPA-ready Excel package.

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

On first run the SQLite DB is created at `./data/amari.db` and seeded with all 15 Chase accounts.

## Enable the AI assistant (optional)

The floating **Ask AI** button in the bottom-right corner can answer questions about your data, navigate you to filtered views, and export CSVs on command. It needs an Anthropic API key.

1. Sign in (or create an account) at <https://console.anthropic.com>.
2. Go to **Settings → API Keys** and click **Create Key**. Copy it (starts with `sk-ant-…`).
3. In the project root, create a file called `.env.local` containing:
   ```
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
4. Stop and restart `npm run dev`.

The model defaults to `claude-opus-4-7`. To use a cheaper model, add a second line:
```
ANTHROPIC_MODEL=claude-haiku-4-5
```

Cost ballpark per question (with the system prompt cached): Haiku ≈ $0.001, Sonnet ≈ $0.01, Opus ≈ $0.03.

### What you can ask
- "Bring up all Zelle transactions" → opens `/transactions?…` filtered to Zelle.
- "Export every Spacetel wire to CSV" → returns a download button.
- "Total spend by entity this month" → returns a bar breakdown.
- "Show me wires over $1,000."
- "How much did I pay Sami this year?"

## Workflow

1. **Import** (`/import`) — drag in one or many `Chase####_Activity_*.CSV` files. Account number is auto-detected from the filename. Each row is parsed, categorized, entity-tagged, audit-scored, and de-duplicated by `(account, date, amount, description)`. Internal transfers are matched automatically after every import.
2. **Audit review** (`/audit`) — work through flagged transactions sorted by audit score. Confirm entity, business purpose, doc reference, then mark **Confirm / Needs receipt / Personal / Skip**.
3. **Transactions** (`/transactions`) — full ledger view with filters (account, entity, status, search, flags only, hide/show internal).
4. **Zelle / 1099** (`/zelle`) — every Zelle recipient with totals, last paid, classification, 1099 status.
5. **Entity P&L** (`/pl`) — rolled-up P&L per business entity.
6. **Income tracker** (`/income`) — income by source with a Spacetel timeline showing same-day outflows.
7. **CPA Export** (`/cpa`) — one-click Excel workbook for your accountant.

## Categorization engine

The brain of the app: `src/lib/parsers/categorizer.ts`.

- Internal transfers are detected first (`ACCT_XFER`, `ODP TRANSFER`, `Online Transfer …`) and excluded from P&L.
- Income rules detect Spacetel, Omar Alghazali (Spacetel?), TCETRA, Vidapay, Stripe, DoorDash, Grubhub, Uber Eats, Gusto refunds, and generic wires.
- Expense rules cover the full Bytes AI software stack (LiveKit, Upstash, Twilio, Telnyx, VAPI, Anthropic, OpenAI, Cursor, Linear, …), business-shared tools (AWS, Google Workspace, Zoom), payroll (Gusto), processing fees (TransFirst/TSYS), food vendors (NYC Apple Deli, Mr Pizza Man, KitchenHub, Food Hub UK), and personal categories.
- Zelle recipient names are extracted and matched against the known-person list (`src/constants/zelle-persons.ts`), driving 1099 detection.
- High-risk wires (Abu Dhabi Islamic Bank, Remitly, Wise) get audit score 100/68.

## Tech

- **Next.js 14** App Router + React Server Components
- **TypeScript** strict mode
- **Tailwind CSS** with dark theme
- **better-sqlite3** (local, synchronous, fast)
- **Papa Parse** for CSV
- **SheetJS (xlsx)** for the Excel export
- **react-dropzone** for upload UX

## Data privacy

Everything runs locally. The SQLite database, your raw CSVs, and the categorized ledger never leave your machine. No external API calls.

## Layout

```
src/
  app/
    layout.tsx, page.tsx                    Sidebar + dashboard
    import/                                 CSV drag-and-drop
    transactions/                           Filterable ledger
    audit/                                  Flagged review cards
    accounts/, income/, zelle/, pl/         Other views
    cpa/                                    Export preview
    api/cpa/                                Excel download endpoint
    reconcile/                              Internal transfer status
  components/                               EntityBadge, FlagBadge, Money, Sidebar
  lib/
    db/                                     better-sqlite3 schema + queries
    parsers/                                csv, categorizer, reconciler
    exporters/                              cpa-excel
  constants/                                accounts, merchants, zelle-persons
  types/                                    TS interfaces
```

## Next iterations

- Bulk-tag operations in `/transactions`
- Recharts time-series in `/income`
- Keyboard shortcuts in `/audit` (1/2/3/4 + arrow keys)
- Receipt photo upload
- Plaid sync to replace CSV imports
