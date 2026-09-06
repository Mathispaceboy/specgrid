# SpecGrid

India's technical manufacturer directory. specgrid.in

This repo is a **fresh git source of truth**, reconstructed on 2026-09-05 directly
from what was actually live in Cloudflare at the time (not from any prior repo).
The previous GitHub repo mixed in an unrelated `cloudflare/` folder from the
deferred Intelligence Radar project and had drifted from production — this repo
intentionally starts clean.

## Structure

```
web/            The specgrid-web Worker — renders every public HTML page
                 (homepage, search, company profiles, claim flow, account,
                 admin, legal pages) and proxies to the API.
  worker.js
  wrangler.toml

api/            The specgrid-api Worker — the JSON API (search, companies,
                 claims, enquiries, analytics, admin endpoints). Auth is Clerk,
                 verified via JWKS (no secret key required for verification).
  worker.js
  wrangler.toml

db/
  schema.sql    Exact CREATE TABLE + index statements pulled from the LIVE
                 production D1 database (specgrid-db) on 2026-09-05. This is
                 now the source of truth — the old staging database
                 (specgrid-db-staging) had drifted (missing founding_members /
                 sessions / visitor_identities; had an unrelated radar_posts
                 table from Intelligence Radar) and should not be used as a
                 reference going forward.
```

## Known gaps in this reconstruction (fix before or shortly after first deploy)

1. **OG image not re-embedded.** The live Worker embeds a ~9KB base64 PNG as
   `OG_IMAGE_B64` in `web/worker.js`. That exact binary was not hand-transcribed
   into this repo (too error-prone to copy by hand). `OG_IMAGE_B64` is currently
   an empty string, so `/og-default.png` will serve a broken image until you
   either fetch the live one from `https://specgrid.in/og-default.png` and
   paste it in base64, or generate a fresh one.
2. **No GitHub Actions / CI yet.** Deploy today via Cloudflare's native Git
   integration (see below) — no build step is needed since these are
   plain-JS Workers with no bundler.
3. **`specgrid-web` calls `specgrid-api` over its public `.workers.dev` URL**
   rather than a service binding. Works fine, but a service binding (commented
   out in `web/wrangler.toml`) would be faster and avoid exposing the API
   publicly. Not urgent.
4. **No secrets are needed for the current feature set.** Clerk auth in
   `api/worker.js` verifies JWTs against Clerk's public JWKS endpoint — there
   is no Clerk secret key in this codebase to manage. The one Clerk key in
   `web/worker.js` (`CLERK_PUBLISHABLE_KEY`) is a *publishable* key, safe to
   keep in source. If you add Razorpay or any other integration that needs a
   real secret, set it via `wrangler secret put <NAME>` or the Cloudflare
   dashboard — never hardcode it in `worker.js`.

## First-time setup

1. **Create the GitHub repo** (if not already done) and push this folder:
   ```
   cd specgrid
   git init
   git add .
   git commit -m "Initial commit: reconstructed from live production, 2026-09-05"
   git branch -M main
   git remote add origin https://github.com/<your-username>/specgrid.git
   git push -u origin main
   ```

2. **Connect both Workers to this repo** in the Cloudflare dashboard:
   - Workers & Pages → `specgrid-web` → Settings → Builds & deployments →
     connect to this repo, root directory `web/`.
   - Workers & Pages → `specgrid-api` → Settings → Builds & deployments →
     connect to this repo, root directory `api/`.
   - Every push to `main` will now auto-deploy. No build command needed
     (plain JS, no bundler) — just "deploy on push."

3. **Point specgrid.in's custom domain** at `specgrid-web` if it isn't already
   (Workers & Pages → specgrid-web → Settings → Domains & Routes).

4. **D1 database**: already exists and is bound in `api/wrangler.toml`
   (`specgrid-db`, id `d91ecc07-a703-4b4b-bd18-1942b288c27b`). Nothing to
   recreate — this repo's `db/schema.sql` is documentation of its current
   shape, not a script you need to (re-)run against production.

5. **Local development**: clone this repo, `cd api && wrangler dev` /
   `cd web && wrangler dev` to run either Worker locally. Point `API_BASE` in
   `web/worker.js` at `http://localhost:8787` temporarily if you want to test
   against a local API instance.

## Notes on the old `specgrid-staging` / `specgrid-api-staging` Workers

These still exist in the Cloudflare account with a drifted schema (missing 3
production tables, plus an unrelated `radar_posts` table). They are not
touched by this repo or its deploy setup. Decide separately whether to
delete them, reset them to match production, or repurpose them as a real
staging environment once Intelligence Radar becomes an active project again.
