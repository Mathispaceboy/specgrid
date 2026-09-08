# SpecGrid — Device Migration & Setup Guide

This guide is for setting up and running **SpecGrid** on any new computer or environment without needing prior folder structures or environment state.

---

## 1. Quick Start / Prerequisites

Ensure your system has the following installed:
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `10.x` or higher
- **Git**: standard git CLI
- **Cloudflare Wrangler CLI**: Installed globally or invoked via `npx wrangler`

Check your environment:
```bash
node -v
npm -v
git --version
```

---

## 2. Cloning the Repository

Clone the repository anywhere on your filesystem:

```bash
git clone https://github.com/Mathispaceboy/specgrid.git
cd specgrid
```

---

## 3. Repository Architecture

```text
specgrid/
├── wrangler.jsonc             # Root Cloudflare configuration used by Cloudflare Git CI
├── web/                       # Astro 5 SSR Web Application (deployed as specgrid-web)
│   ├── astro.config.mjs       # Astro configuration with Cloudflare adapter and redirects
│   ├── wrangler.toml          # Web worker configuration & D1 database binding
│   ├── package.json           # Astro & frontend dependencies
│   ├── src/
│   │   ├── content/radar/     # Intelligence Radar markdown dispatches (Content Collections)
│   │   ├── layouts/           # BaseLayout with SEO, OpenGraph, JSON-LD, attribution tracking
│   │   ├── components/        # Header, Footer, navigation elements
│   │   ├── pages/             # SSR page routes:
│   │   │   ├── index.astro            # Homepage with capability index & category tiles
│   │   │   ├── search.astro           # Paginated search directory with parameter filters & sorting
│   │   │   ├── companies/
│   │   │   │   └── [slug].astro       # Full technical company profile & peer cluster comparison
│   │   │   ├── radar/                 # Technical intelligence dispatches & markdown articles
│   │   │   ├── claim/[slug].astro     # Supplier profile claim flow
│   │   │   ├── enquire/[slug].astro   # Direct enquiry submission with rate limiting
│   │   │   └── account/               # Supplier management dashboard
│   │   └── styles/                    # Curated design tokens and monospace aesthetics
│   └── data/
│       └── master_technical_database.md # Master reference dataset for all 189 companies
├── api/                       # REST API Worker (deployed as specgrid-api)
│   ├── worker.js              # Full API router (search, companies, claims, tracking, JWKS auth)
│   └── wrangler.toml          # API worker Cloudflare configuration & D1 binding
├── db/                        # Database schemas, migrations, and complete backups
│   ├── schema.sql             # Complete table creation & indexing statements
│   ├── ingest_technical_specs.sql # SQL transaction batch populating 194 products & specs
│   └── backup_live_database.sql   # Full snapshot of production D1 database (tables + data)
└── scripts/                   # Automated data manipulation & ingestion tools
    └── ingest_technical_specs.js # Ingestion script compiling markdown to SQL transactions
```

---

## 4. Local Development

### A. Web Frontend (Astro 5)

Install dependencies and start the Astro development server:

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

### B. API Worker (Cloudflare Workers)

To run the API Worker locally with a simulated local database or connected to remote D1:

```bash
cd api
# Local simulation:
npx wrangler dev

# Or test against remote production D1 directly:
npx wrangler dev --remote
```

The API worker will run on `http://localhost:8787`.

---

## 5. Cloudflare D1 Database Configuration

- **Database Name**: `specgrid-db`
- **Database ID**: `d91ecc07-a703-4b4b-bd18-1942b288c27b`

### Authenticating Wrangler

On a new device, log in to Cloudflare with your account:

```bash
npx wrangler login
```

Verify you are logged in:
```bash
npx wrangler whoami
```

### Database Restoration & Seeding

The repository contains a full database export at `db/backup_live_database.sql`.

- **To inspect tables on production D1**:
  ```bash
  npx wrangler d1 execute specgrid-db --remote --command="SELECT COUNT(*) as companies FROM companies;"
  npx wrangler d1 execute specgrid-db --remote --command="SELECT COUNT(*) as products FROM products;"
  ```

- **To seed a fresh local D1 database for offline development**:
  ```bash
  npx wrangler d1 execute specgrid-db --local --file=db/backup_live_database.sql
  ```

- **To re-seed or restore the remote database from the backup**:
  ```bash
  npx wrangler d1 execute specgrid-db --remote --file=db/backup_live_database.sql
  ```

---

## 6. Building & Deploying

### Option 1: Automatic Git Deployments (Recommended)
Cloudflare's Git pipeline is configured to automatically build and deploy whenever you push to `main`:
- Cloudflare detects `wrangler.jsonc` at repository root.
- Runs `cd web && npm install && npm run build`.
- Uploads the worker and assets seamlessly.

### Option 2: Manual Deployments from Terminal

**To deploy the web app (`specgrid-web`)**:
```bash
# From repository root:
npx wrangler deploy

# Or from web/ directory:
cd web
npm run build
npx wrangler deploy -c wrangler.toml
```

**To deploy the API worker (`specgrid-api`)**:
```bash
cd api
npx wrangler deploy -c wrangler.toml
```

---

## 7. Custom Domains & Production Endpoints

- **Live Website**: [https://specgrid.in](https://specgrid.in)
- **Directory / Search**: [https://specgrid.in/search](https://specgrid.in/search)
- **Intelligence Radar**: [https://specgrid.in/radar](https://specgrid.in/radar)
- **API Production Worker**: `https://specgrid-api.mathispaceboy.workers.dev`
- **Web Production Worker**: `https://specgrid-web.mathispaceboy.workers.dev`

---

## 8. Authentication & External Services

- **Clerk Authentication**:
  - `CLERK_ISSUER`: `https://busy-cricket-1133.clerk.accounts.dev`
  - Auth verification in `api/worker.js` uses Clerk's public JWKS endpoint (`/.well-known/jwks.json`).
  - No secret keys are required for verification; claims are checked directly via RSA SHA-256 subtle crypto.
