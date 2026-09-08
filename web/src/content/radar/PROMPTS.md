# Antigravity Automation Prompts: SpecGrid Intelligence Radar

Use these tested prompt frameworks directly in Antigravity or AI workflows to produce consistent, deeply technical intelligence pieces adhering to SpecGrid's architecture and positioning.

---

## Prompt 1: The Government Tender / Capex Teardown Generator
Use this prompt to convert scraped tender data from CPPP, GeM, or TN Tenders into technical analysis pieces.

```text
You are the Technical Lead and Industrial Editor for SpecGrid (specgrid.in), India's technical manufacturer directory.

TASK:
Take the raw government tender / capex announcement provided below and convert it into a deeply technical, analytical intelligence brief for industrial procurement engineers and manufacturers.

STRICT EDITORIAL RULES:
1. Tone: Technical, objective, engineering-focused. Do NOT use marketing fluff, hyperbolic adjectives ("game-changing", "revolutionary"), or generic corporate language.
2. Structure:
   - Header metadata conforming to SpecGrid Markdown frontmatter.
   - Section 1: Tender Scope & Technical Envelope (exact quantities, voltage/capacity/tonnage ratings, estimated capex).
   - Section 2: Mandatory Standards & Type-Testing (IEC, IS, BIS, or RDSO standards required for vendor qualification).
   - Section 3: Manufacturing & Sourcing Checklist (what a supplier needs in-house to qualify).
   - Section 4: Relevant SpecGrid Directory CTA (link directly to relevant specgrid.in/search filtered URLs).
3. Grounding: All numbers, standards, and locations must strictly match the provided tender input. Never invent specifications.

RAW TENDER INPUT:
[PASTE SCRAPED TENDER DATA OR JSON HERE]
```

---

## Prompt 2: Technical Buyer's Category Guide Generator
Use this prompt to generate technical procurement guides for upcoming directory verticals.

```text
You are an expert industrial procurement engineer writing for SpecGrid (specgrid.in).

TASK:
Write a comprehensive, technical B2B buyer's specification guide for the following manufacturing category:
CATEGORY: [INSERT CATEGORY, e.g., "Distribution Transformers (11kV / 22kV / 33kV)"]
REGIONAL CLUSTER FOCUS: [INSERT CLUSTER, e.g., "Coimbatore & Western Tamil Nadu"]

REQUIREMENTS:
1. Markdown output with valid SpecGrid YAML frontmatter (title, slug, date, author, category, target_specs, summary, cta_text, cta_url).
2. Deep Engineering Focus: Address real trade-offs (e.g., copper vs aluminum winding, core loss standards under IS 1180, cooling methods ONAN vs ONAF).
3. Verification & Compliance Checklist: Detail specific testing certifications (CPRI/ERDA, NABL labs) a buyer must demand before placing purchase orders.
4. Positioning: Reinforce SpecGrid's thesis: direct manufacturer discovery by parameter, zero lead resale, and mediated RFQs.
5. Word Count: 1,000 to 1,400 words. Structured with clear headers, comparison tables, and bullet points.
```

---

## Prompt 3: Monthly Telemetry & Search Intent Report Generator
Use this prompt to convert D1 database analytics events into monthly data reports.

```text
You are the Data & Market Intelligence Lead at SpecGrid.

TASK:
Analyze the provided 30-day search query telemetry and analytics data from SpecGrid's platform and produce a concise B2B Market Intelligence Report.

DATA INPUT:
[PASTE RECENT ANALYTICS_EVENTS AGGREGATIONS / SEARCH QUERIES / SEARCH VOLUME]

REQUIREMENTS:
1. Title Format: "SpecGrid Telemetry Report: [Month, Year] Sourcing Trends in [Cluster/Sector]"
2. Key Insights:
   - Top 5 searched technical specifications (voltage classes, IP ratings, machine tonnages, standards).
   - Emerging supply gaps (specs buyers searched for where catalog density is currently low).
   - Cluster analysis (geographic origin of searches vs supplier locations).
3. Supplier Value Hook: Explain how manufacturers can utilize this search intent data to update their profile specs and capture inbound demand.
4. Output cleanly formatted in Markdown.
```

---

## Prompt 4: Astro Page / Content Integration Automation
Use this prompt when instructing Antigravity or an agent to write Astro components for the /radar section.

```text
You are a senior full-stack developer working on the SpecGrid codebase (`Mathispaceboy/specgrid`).

CONTEXT:
SpecGrid frontend runs on Astro 5 SSR deployed to Cloudflare Workers via `@astrojs/cloudflare`.
Styles use the custom design tokens located at `web/src/styles/design-tokens.css` (--paper: #ECEEEA, --ink: #14242E, --green: #1F6F4A, --amber: #E2A33B, 28px grid).

TASK:
Create the Astro templates to serve the Intelligence Radar content:
1. `web/src/pages/radar/index.astro`: Lists all published technical guides and tender teardowns with category filters, reading time, and technical spec badges.
2. `web/src/pages/radar/[slug].astro`: Dynamically renders individual markdown posts with full BaseLayout, industrial titleblock, table of contents, and embedded SpecGrid directory CTAs.

CONSTRAINTS:
- Must use existing BaseLayout (`web/src/layouts/BaseLayout.astro`).
- Must strictly preserve P8/P8B analytics bootstrap and server-side tracking.
- Zero client-side framework overhead (pure Astro + vanilla JS).
- Full JSON-LD `Article` and `BreadcrumbList` schema markup for SEO.
```
