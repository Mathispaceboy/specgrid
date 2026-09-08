# SpecGrid Frontend Architecture & System Reference

This document describes the technical architecture, design system, routing rules, and deployment setup for the frontend application of SpecGrid (`web/`).

---

## 1. Stack Overview

- **Framework**: Astro 5 (Server-Side Rendered)
- **Deployment Platform**: Cloudflare Workers (`@astrojs/cloudflare`)
- **Language**: Vanilla JavaScript & Astro Components
- **Styling**: Vanilla CSS with Design Tokens (`web/src/styles/design-tokens.css`)
- **Authentication**: Clerk JS SDK (Client-side CDN integration)
- **Backend API**: `specgrid-api` Worker (`https://specgrid-api.mathispaceboy.workers.dev`)
- **Telemetry**: First-party P8/P8B visitor (`sg_vid`) & session (`sg_sid`) attribution

---

## 2. Directory Structure

```
web/
├── package.json        # Dependencies (astro, @astrojs/cloudflare) & build scripts
├── astro.config.mjs    # Astro configuration (output: 'server', cloudflare adapter)
├── wrangler.toml       # Cloudflare Workers configuration (main, assets, compatibility)
├── worker.js           # Reference copy of original single-file worker
├── design/             # Visual reference files (specgrid-demo.html, cards)
└── src/
    ├── middleware.js   # Dual-routing middleware (coexistence & noindex injection)
    ├── legacy/
    │   └── legacyWorker.js # Original worker engine for ?version=legacy fallback
    ├── styles/
    │   └── design-tokens.css # Industrial blueprint CSS variables & typography
    ├── layouts/
    │   └── BaseLayout.astro  # HTML head, OpenGraph, JSON-LD, P8/P8B bootstrap
    ├── components/
    │   ├── Header.astro      # Navigation, SVG grid logo, supplier CTA
    │   └── Footer.astro      # Legal links, cluster origin badge, copyright
    ├── utils/
    │   └── tracking.js       # Server-side fire-and-forget telemetry
    └── pages/
        ├── index.astro       # Homepage: Search hero, trust bar, category grid
        ├── search.astro      # Directory search with facets sidebar & filters
        ├── companies/
        │   └── [slug].astro  # Technical spec sheet, verified badges, WhatsApp RFQ
        ├── enquire/
        │   └── [slug].astro  # Mediated RFQ form with validation & tracking
        ├── claim/
        │   └── [slug].astro  # Company claim flow with domain match detection
        ├── for-suppliers.astro # Supplier conversion, intent telemetry, FAQs
        ├── about.astro       # Mission & Coimbatore cluster background
        ├── terms.astro       # Commercial & directory terms
        ├── privacy.astro     # Privacy policy & telemetry disclosure
        ├── data-disclaimer.astro # Public compilation & verification tier disclosure
        ├── account/
        │   ├── index.astro   # Supplier account portal (Clerk auth)
        │   └── edit/
        │       └── [slug].astro # Profile editor (Specs, categories, certs)
        ├── admin.astro       # Admin dashboard (Clerk auth, KPIs, claims review)
        ├── robots.txt.js     # Crawler directives & sitemap location
        ├── sitemap.xml.js    # Dynamic XML sitemap indexing all live companies
        ├── og-default.png.js # Fallback OpenGraph image endpoint
        └── 404.astro         # Industrial blueprint 404 error page
```

---

## 3. Design System (`web/src/styles/design-tokens.css`)

The UI is inspired by an engineering specification sheet / blueprint aesthetic:
- **Palette**:
  - `--paper`: `#ECEEEA` (Primary technical background)
  - `--paper-warm`: `#F4F5F1` (Card and panel background)
  - `--ink`: `#14242E` (High-contrast charcoal headings & typography)
  - `--ink-soft`: `#384A54` (Readable body copy)
  - `--ink-muted`: `#62747E` (Metadata and secondary labels)
  - `--green`: `#1F6F4A` (Verified badges, primary CTAs, active status)
  - `--green-pale`: `#E4EFEA` (Verified background containers)
  - `--amber`: `#E2A33B` (Founding member badges, warnings, notices)
  - `--amber-pale`: `#FBF4E8` (Amber alert backgrounds)
  - `--border-color`: `#CAD2D0` (Blueprint grid rule)
- **Grid Pattern**: 28px coordinate grid on `body`.
- **Typography**:
  - Headings: `Space Grotesk`, sans-serif
  - Body: `Inter`, -apple-system, sans-serif
  - Codes, Ratings & Metadata: `IBM Plex Mono`, monospace

---

## 4. Dual-Routing & Fallback Mechanism

[`web/src/middleware.js`](file:///Volumes/new%20/sg/specgrid/web/src/middleware.js) intercepts incoming requests:
- If a route is unmigrated or if `?version=legacy` is appended to the URL:
  - The request is delegated to [`web/src/legacy/legacyWorker.js`](file:///Volumes/new%20/sg/specgrid/web/src/legacy/legacyWorker.js).
  - An `X-Robots-Tag: noindex, nofollow` header is added to the HTTP response.
  - `<meta name="robots" content="noindex, nofollow">` is injected immediately after `<head>`.
- Standard requests to migrated routes pass directly to the Astro SSR renderer.

---

## 5. Cloudflare Workers Builds Setup

In the Cloudflare Dashboard under **Workers & Pages** > **`specgrid-web`** > **Settings** > **Builds & deployments**:
- **Root Directory**: `web`
- **Build Command**: `npm install && npm run build`
- **Deploy Command**: `npx wrangler deploy`

### Static Asset Uploads & `.assetsignore`
When building the project (`npm run build`), Astro generates:
- `dist/_worker.js` (The server script)
- `dist/_astro/` (Client CSS, fonts, and scripts)

To prevent Wrangler from uploading the server script as a public downloadable static asset, the build script in `web/package.json` automatically generates `dist/.assetsignore` containing:
```
_worker.js
_routes.json
```
This satisfies Cloudflare Wrangler's security validation.
