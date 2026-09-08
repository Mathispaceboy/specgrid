# SpecGrid

> **India's Technical Manufacturer Directory** — [https://specgrid.in](https://specgrid.in)

SpecGrid indexes verified engineering and manufacturing capabilities across industrial clusters (machine locking force, operating voltages, steel alloys, testing standards) and connects technical buyers and EPC engineers directly with factories.

---

## 🚀 Key Highlights & Architecture

- **Web Frontend (`web/`)**: Built on **Astro 5 (SSR)** deployed to Cloudflare Workers with `@astrojs/cloudflare`. Features fast server-side rendering, monospace design system, paginated directory search, specification shortcuts, and direct inquiry routing.
- **Content Engine (`web/src/content/radar/`)**: **SpecGrid Intelligence Radar** — in-depth procurement guides and regional manufacturing cluster teardowns powered by Astro Content Collections.
- **API Engine (`api/`)**: REST API Worker deployed to Cloudflare Workers (`specgrid-api`). Handles fuzzy/deep parameter searches across companies, products, specifications JSON, and certifications.
- **Database (`db/`)**: **Cloudflare D1** (`specgrid-db`), holding 189 verified manufacturers, 194 detailed product specification sheets, and 114 type-test certifications (CPRI, ERDA, UL, NABL, IS 1180, ISO).

---

## 📁 Repository Structure

```text
specgrid/
├── wrangler.jsonc             # Root configuration for Cloudflare Git CI pipeline
├── DEVICE_MIGRATION_GUIDE.md  # Detailed setup guide for new machines & environments
├── web/                       # Astro 5 SSR application (specgrid-web)
│   ├── astro.config.mjs       # Astro config with Cloudflare adapter & redirects
│   ├── wrangler.toml          # Web worker configuration & D1 database binding
│   ├── src/
│   │   ├── content/radar/     # Intelligence Radar technical articles
│   │   ├── pages/             # SSR routes (/search, /companies/[slug], /radar, etc.)
│   │   ├── components/        # UI components (Header, Footer)
│   │   ├── layouts/           # BaseLayout with SEO, JSON-LD, OpenGraph
│   │   └── styles/            # Design tokens and monospace styling
│   └── data/
│       └── master_technical_database.md # 189-company master reference dataset
├── api/                       # REST API Worker (specgrid-api)
│   ├── worker.js              # Full API router with JWT verification
│   └── wrangler.toml          # API worker Cloudflare configuration
├── db/                        # Database schemas, scripts, and complete snapshots
│   ├── schema.sql             # Table definitions & indexes
│   ├── ingest_technical_specs.sql # Product & specification transaction batch
│   └── backup_live_database.sql   # Complete SQL dump of production D1 database
└── scripts/                   # Migration & ingestion automation scripts
    └── ingest_technical_specs.js
```

---

## ⚡ Quick Start on a New Device

For complete instructions, see [DEVICE_MIGRATION_GUIDE.md](./DEVICE_MIGRATION_GUIDE.md).

### 1. Install & Run Web App
```bash
cd web
npm install
npm run dev
```
Runs locally at `http://localhost:4321`.

### 2. Run API Worker
```bash
cd api
npx wrangler dev --remote
```
Runs locally at `http://localhost:8787` connected to the remote D1 database.

---

## 💾 Database State & Backups

- **Cloudflare D1 Database Name**: `specgrid-db`
- **Database ID**: `d91ecc07-a703-4b4b-bd18-1942b288c27b`

The latest production database dump is saved in version control:
- [`db/backup_live_database.sql`](./db/backup_live_database.sql) — Contains all table schemas and live records for `companies`, `products`, `certifications`, `categories`, `enquiries`, `company_claims`, `users`, and `audit_logs`.

To restore or seed a local or remote database:
```bash
# Seed local offline database:
npx wrangler d1 execute specgrid-db --local --file=db/backup_live_database.sql

# Restore remote production database:
npx wrangler d1 execute specgrid-db --remote --file=db/backup_live_database.sql
```

---

## 🚢 Deployment

### Automatic Git CI/CD
Cloudflare's Git pipeline builds and deploys on every push to `main` using root `wrangler.jsonc`.

### Manual CLI Deploy
```bash
# Deploy Web Worker:
npx wrangler deploy

# Deploy API Worker:
cd api && npx wrangler deploy -c wrangler.toml
```

---

## 🌐 Production URLs

- **Live Application**: [https://specgrid.in](https://specgrid.in)
- **Technical Directory**: [https://specgrid.in/search](https://specgrid.in/search)
- **Intelligence Radar**: [https://specgrid.in/radar](https://specgrid.in/radar)
- **API Worker**: `https://specgrid-api.mathispaceboy.workers.dev`
