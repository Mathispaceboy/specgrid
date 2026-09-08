const PUBLIC_COMPANY_FIELDS = ` id, slug, name, status, category_id, company_type, location_city, location_state, founded_year, employee_band, description, website, logo_url, spec_id, whatsapp_number `;

// --- Clerk auth (P5A) ---
// Networkless-style JWT verification against Clerk's JWKS, done by hand
// (no npm deps, since this Worker is deployed via a single-file paste).
// Requires the Clerk session token to carry an "email" claim — set that up
// in Clerk Dashboard > Sessions > Edit token, add: "email": "{{user.primary_email_address}}"
const CLERK_ISSUER = "https://busy-cricket-1133.clerk.accounts.dev";
const CLERK_JWKS_URL = `${CLERK_ISSUER}/.well-known/jwks.json`;
let _jwksCache = null, _jwksCacheAt = 0;
async function getJwks() {
  if (_jwksCache && Date.now() - _jwksCacheAt < 3600000) return _jwksCache;
  const res = await fetch(CLERK_JWKS_URL);
  _jwksCache = await res.json();
  _jwksCacheAt = Date.now();
  return _jwksCache;
}
function b64urlToUint8(b64url) {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
async function verifyClerkToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToUint8(headerB64)));
    payload = JSON.parse(new TextDecoder().decode(b64urlToUint8(payloadB64)));
  } catch { return null; }
  if (header.alg !== "RS256") return null;
  const jwks = await getJwks();
  const jwk = (jwks.keys || []).find(k => k.kid === header.kid);
  if (!jwk) return null;
  let key;
  try {
    key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  } catch { return null; }
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = b64urlToUint8(sigB64);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data);
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  if (payload.nbf && now < payload.nbf) return null;
  if (payload.iss !== CLERK_ISSUER) return null;
  return payload;
}
async function requireUser(request) {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer (.+)$/);
  if (!m) return null;
  const payload = await verifyClerkToken(m[1]);
  if (!payload) return null;
  const email = payload.email || payload.primary_email_address || null;
  return { payload, email };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders() } });
}
function notFound(msg = "Not found") { return json({ error: msg }, 404); }
function badRequest(msg) { return json({ error: msg }, 400); }

function serializePublicCompany(row) {
  if (!row) return null;
  return {
    id: row.id, slug: row.slug, name: row.name, status: row.status,
    category: row.category_id, companyType: row.company_type,
    location: { city: row.location_city, state: row.location_state },
    foundedYear: row.founded_year, employeeBand: row.employee_band,
    description: row.description, website: row.website, logoUrl: row.logo_url,
    specId: row.spec_id, enquireUrl: `/enquire/${row.slug}`,
    whatsappNumber: row.whatsapp_number || null,
  };
}
function serializeCategory(row) {
  return { id: row.id, slug: row.slug, name: row.name, level: row.level, filterSchema: row.filter_schema ? JSON.parse(row.filter_schema) : [], description: row.description, icon: row.icon };
}
function serializeCertification(row) {
  return { id: row.id, name: row.name, issuingBody: row.issuing_body, validUntil: row.valid_until, verified: !!row.verified };
}

const RATE_LIMIT = 5;
const RATE_WINDOW_MINUTES = 60;
async function isRateLimited(env, identifier) {
  const { results } = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM enquiries WHERE (buyer_email = ? OR buyer_phone = ?) AND created_at >= datetime('now', ?)`
  ).bind(identifier, identifier, `-${RATE_WINDOW_MINUTES} minutes`).all();
  return (results?.[0]?.c ?? 0) >= RATE_LIMIT;
}
async function isClaimRateLimited(env, identifier) {
  const { results } = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM company_claims cc JOIN users u ON u.id = cc.user_id WHERE u.email = ? AND cc.created_at >= datetime('now', ?)`
  ).bind(identifier, `-${RATE_WINDOW_MINUTES} minutes`).all();
  return (results?.[0]?.c ?? 0) >= RATE_LIMIT;
}

async function handleListCompanies(url, env) {
  const params = url.searchParams;
  const category = params.get("category");
  const companyType = params.get("company_type");
  const state = params.get("state");
  const q = params.get("q");
  const hasCertification = params.get("has_certification");
  const limit = Math.min(parseInt(params.get("limit") || "24", 10), 100);
  const offset = Math.max(parseInt(params.get("offset") || "0", 10), 0);
  let where = ["public_visible = 1"];
  let binds = [];
  if (category) { where.push("category_id = ?"); binds.push(category); }
  if (companyType) { where.push("company_type = ?"); binds.push(companyType); }
  if (state) { where.push("location_state = ?"); binds.push(state); }
  if (q) {
    where.push(`(
      name LIKE ? OR description LIKE ?
      OR EXISTS (SELECT 1 FROM products p WHERE p.company_id = companies.id AND (p.name LIKE ? OR p.description LIKE ? OR p.specs LIKE ?))
      OR EXISTS (SELECT 1 FROM certifications c WHERE c.company_id = companies.id AND (c.name LIKE ? OR c.issuing_body LIKE ?))
    )`);
    const qTerm = `%${q}%`;
    binds.push(qTerm, qTerm, qTerm, qTerm, qTerm, qTerm, qTerm);
  }
  if (hasCertification === "true") {
    where.push("EXISTS (SELECT 1 FROM certifications WHERE certifications.company_id = companies.id)");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countStmt = env.DB.prepare(`SELECT COUNT(*) as c FROM companies ${whereSql}`).bind(...binds);
  const listStmt = env.DB.prepare(`SELECT ${PUBLIC_COMPANY_FIELDS} FROM companies ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`).bind(...binds, limit, offset);
  const [countRes, listRes] = await Promise.all([countStmt.all(), listStmt.all()]);
  const companies = (listRes.results || []).map(serializePublicCompany);

  if (companies.length > 0) {
    const companyIds = companies.map(c => c.id);
    const placeholders = companyIds.map(() => "?").join(",");
    const prodsRes = await env.DB.prepare(
      `SELECT company_id, name, specs FROM products WHERE company_id IN (${placeholders}) ORDER BY created_at ASC`
    ).bind(...companyIds).all();

    const prodsByCompany = {};
    for (const p of (prodsRes.results || [])) {
      if (!prodsByCompany[p.company_id]) prodsByCompany[p.company_id] = [];
      let parsedSpecs = null;
      if (p.specs) {
        try { parsedSpecs = JSON.parse(p.specs); } catch (e) { parsedSpecs = null; }
      }
      prodsByCompany[p.company_id].push({ name: p.name, specs: parsedSpecs });
    }

    for (const c of companies) {
      c.products = prodsByCompany[c.id] || [];
    }
  }

  return json({ total: countRes.results?.[0]?.c ?? 0, limit, offset, results: companies });
}

const COMPANY_TYPES = ["manufacturer", "trader_distributor", "service_provider", "epc_contractor", "other"];
async function handleFilterOptions(env) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT location_state as v FROM companies WHERE public_visible = 1 AND location_state IS NOT NULL AND location_state != '' ORDER BY v ASC`
  ).all();
  return json({ companyTypes: COMPANY_TYPES, states: (results || []).map(r => r.v) });
}

async function handleGetCompany(slug, env) {
  const { results } = await env.DB.prepare(`SELECT ${PUBLIC_COMPANY_FIELDS} FROM companies WHERE slug = ? AND public_visible = 1`).bind(slug).all();
  if (!results || results.length === 0) return notFound("Company not found");
  const company = serializePublicCompany(results[0]);
  const [certsRes, prodsRes] = await Promise.all([
    env.DB.prepare(`SELECT id, name, issuing_body, valid_until, verified FROM certifications WHERE company_id = ?`).bind(company.id).all(),
    env.DB.prepare(`SELECT id, name, slug, description, specs FROM products WHERE company_id = ? ORDER BY created_at ASC`).bind(company.id).all(),
  ]);
  company.certifications = (certsRes.results || []).map(serializeCertification);
  company.products = (prodsRes.results || []).map(p => {
    let parsedSpecs = null;
    if (p.specs) {
      try { parsedSpecs = JSON.parse(p.specs); } catch (e) { parsedSpecs = null; }
    }
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      specs: parsedSpecs,
    };
  });
  return json(company);
}

async function handleListCategories(env) {
  const { results } = await env.DB.prepare(`SELECT * FROM categories ORDER BY name ASC`).all();
  return json({ results: (results || []).map(serializeCategory) });
}
async function handleGetCategory(slug, env) {
  const { results } = await env.DB.prepare(`SELECT * FROM categories WHERE slug = ?`).bind(slug).all();
  if (!results || results.length === 0) return notFound("Category not found");
  return json(serializeCategory(results[0]));
}

async function handlePostEnquiry(request, env) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }
  const { companySlug, buyerUserId = null, buyerName, buyerEmail, buyerPhone, message, requirementDescription, industry, urgency, subject, responseBy } = body;
  if (!companySlug) return badRequest("companySlug is required");
  if (!buyerName || (!buyerEmail && !buyerPhone)) return badRequest("buyerName and at least one of buyerEmail/buyerPhone are required");
  const identifier = buyerEmail || buyerPhone;
  if (env.RATE_LIMITER) {
    const rl = await env.RATE_LIMITER.limit({ key: identifier });
    if (!rl.success) return json({ error: "Too many enquiries submitted recently. Please try again later." }, 429);
  }
  if (await isRateLimited(env, identifier)) return json({ error: "Too many enquiries submitted recently. Please try again later." }, 429);
  const companyRes = await env.DB.prepare(`SELECT id FROM companies WHERE slug = ? AND public_visible = 1`).bind(companySlug).all();
  if (!companyRes.results || companyRes.results.length === 0) return notFound("Company not found");
  const companyId = companyRes.results[0].id;
  const enquiryId = crypto.randomUUID();
  const finalMessage = message || requirementDescription || "";
  await env.DB.prepare(
    `INSERT INTO enquiries (id, company_id, buyer_user_id, buyer_name, buyer_email, buyer_phone, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'))`
  ).bind(enquiryId, companyId, buyerUserId, buyerName, buyerEmail || null, buyerPhone || null, JSON.stringify({
    message: finalMessage, industry: industry || null, urgency: urgency || null,
    subject: subject || null, responseBy: responseBy || null,
  })).run();
  return json({ id: enquiryId, status: "new", message: "Enquiry submitted. SpecGrid will forward this to the supplier." }, 201);
}

function domainOf(input) {
  if (!input) return null;
  try {
    const withScheme = input.includes("://") ? input : `https://${input}`;
    return new URL(withScheme).hostname.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
}

async function handlePostClaim(request, env) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }
  const { companySlug, name, workEmail } = body;
  if (!companySlug) return badRequest("companySlug is required");
  if (!name || !workEmail) return badRequest("name and workEmail are required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) return badRequest("workEmail is not a valid email address");

  if (await isClaimRateLimited(env, workEmail)) {
    return json({ error: "Too many claim attempts recently. Please try again later, or email mathi@specgrid.in directly." }, 429);
  }

  const companyRes = await env.DB.prepare(`SELECT id, slug, name, website, status FROM companies WHERE slug = ?`).bind(companySlug).all();
  if (!companyRes.results || companyRes.results.length === 0) return notFound("Company not found");
  const company = companyRes.results[0];

  if (company.status === "claimed" || company.status === "founding") {
    return json({ error: "This profile has already been claimed. If that was a mistake, email mathi@specgrid.in." }, 409);
  }

  let userId;
  const existingUser = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(workEmail).all();
  if (existingUser.results && existingUser.results.length > 0) {
    userId = existingUser.results[0].id;
    await env.DB.prepare(`UPDATE users SET name = ? WHERE id = ?`).bind(name, userId).run();
  } else {
    userId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, role, created_at) VALUES (?, ?, ?, 'supplier', datetime('now'))`
    ).bind(userId, workEmail, name).run();
  }

  const claimantDomain = domainOf(workEmail.split("@")[1]);
  const companyDomain = domainOf(company.website);
  const autoApproved = !!companyDomain && !!claimantDomain && companyDomain === claimantDomain;

  const claimId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO company_claims (id, company_id, user_id, status, verification_method, reviewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    claimId, company.id, userId,
    autoApproved ? "approved" : "pending",
    autoApproved ? "email_domain_match" : "manual_review_required",
    autoApproved ? new Date().toISOString() : null
  ).run();

  if (autoApproved) {
    await env.DB.prepare(`UPDATE companies SET status = 'claimed', updated_at = datetime('now') WHERE id = ?`).bind(company.id).run();
  }

  return json({
    claimId,
    status: autoApproved ? "approved" : "pending",
    message: autoApproved
      ? "Your work email matched this company's own website domain, so your claim was approved instantly. Your profile is now marked Verified."
      : "Claim submitted. Since your email domain didn't match the company's listed website, this needs a quick manual check — usually within a day. You can check its status anytime with your claim ID.",
  }, 201);
}

async function handleGetClaimStatus(claimId, env) {
  const { results } = await env.DB.prepare(
    `SELECT cc.status, cc.created_at, cc.reviewed_at, c.slug, c.name, c.status as company_status
     FROM company_claims cc JOIN companies c ON c.id = cc.company_id WHERE cc.id = ?`
  ).bind(claimId).all();
  if (!results || results.length === 0) return notFound("Claim not found");
  const r = results[0];
  return json({ claimId, status: r.status, companySlug: r.slug, companyName: r.name, companyStatus: r.company_status, createdAt: r.created_at, reviewedAt: r.reviewed_at });
}

const ADMIN_EMAILS = ["mathispaceboy@gmail.com"];
async function requireAdmin(request) {
  const auth = await requireUser(request);
  if (!auth) return { error: json({ error: "Unauthorized" }, 401) };
  if (!auth.email || !ADMIN_EMAILS.includes(auth.email)) {
    return { error: json({ error: "Forbidden" }, 403) };
  }
  return { email: auth.email };
}

async function handleAdminListClaims(url, request, env) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const status = url.searchParams.get("status") || "pending";
  const { results } = await env.DB.prepare(
    `SELECT cc.id, cc.status, cc.verification_method, cc.created_at, cc.reviewed_at,
            c.slug as company_slug, c.name as company_name, c.website as company_website,
            u.name as claimant_name, u.email as claimant_email
     FROM company_claims cc
     JOIN companies c ON c.id = cc.company_id
     JOIN users u ON u.id = cc.user_id
     WHERE cc.status = ?
     ORDER BY cc.created_at ASC LIMIT 100`
  ).bind(status).all();
  return json({
    results: (results || []).map(r => ({
      claimId: r.id, status: r.status, verificationMethod: r.verification_method,
      createdAt: r.created_at, reviewedAt: r.reviewed_at,
      companySlug: r.company_slug, companyName: r.company_name, companyWebsite: r.company_website,
      claimantName: r.claimant_name, claimantEmail: r.claimant_email,
    })),
  });
}

async function handleAdminPatchClaim(claimId, request, env) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }
  const { status } = body;
  if (!["approved", "rejected"].includes(status)) return badRequest("status must be approved or rejected");
  const claimRes = await env.DB.prepare(`SELECT company_id, status FROM company_claims WHERE id = ?`).bind(claimId).all();
  if (!claimRes.results?.length) return notFound("Claim not found");
  const claim = claimRes.results[0];
  if (claim.status !== "pending") return badRequest(`Claim is already ${claim.status}`);
  await env.DB.prepare(`UPDATE company_claims SET status = ?, reviewed_at = datetime('now') WHERE id = ?`).bind(status, claimId).run();
  if (status === "approved") {
    await env.DB.prepare(`UPDATE companies SET status = 'claimed', updated_at = datetime('now') WHERE id = ?`).bind(claim.company_id).run();
  }
  return json({ claimId, status });
}

async function handleAdminListCertifications(request, env) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const { results } = await env.DB.prepare(
    `SELECT cert.id, cert.name, cert.issuing_body, cert.valid_until, cert.verified, c.slug as company_slug, c.name as company_name
     FROM certifications cert JOIN companies c ON c.id = cert.company_id
     WHERE cert.verified = 0 ORDER BY cert.id DESC LIMIT 100`
  ).all();
  return json({
    results: (results || []).map(r => ({
      id: r.id, name: r.name, issuingBody: r.issuing_body, validUntil: r.valid_until,
      companySlug: r.company_slug, companyName: r.company_name,
    })),
  });
}

async function handleAdminVerifyCertification(certId, request, env) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const certRes = await env.DB.prepare(`SELECT id FROM certifications WHERE id = ?`).bind(certId).all();
  if (!certRes.results?.length) return notFound("Certification not found");
  await env.DB.prepare(`UPDATE certifications SET verified = 1 WHERE id = ?`).bind(certId).run();
  return json({ id: certId, verified: true });
}

const FOUNDING_CAP = 25;

async function handleFoundingCount(env) {
  const { results } = await env.DB.prepare(`SELECT COUNT(*) as c FROM companies WHERE status = 'founding'`).all();
  const claimed = results?.[0]?.c ?? 0;
  return json({ cap: FOUNDING_CAP, claimed, remaining: Math.max(0, FOUNDING_CAP - claimed) });
}

async function handleAdminMarkFounding(slug, request, env) {
  const { email, error } = await requireAdmin(request);
  if (error) return error;
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }
  const { amountPaid, paymentReference, notes } = body;
  const companyRes = await env.DB.prepare(`SELECT id, status FROM companies WHERE slug = ?`).bind(slug).all();
  if (!companyRes.results?.length) return notFound("Company not found");
  const company = companyRes.results[0];
  if (company.status === "founding") return badRequest("Already a founding member");
  const countRes = await env.DB.prepare(`SELECT COUNT(*) as c FROM companies WHERE status = 'founding'`).all();
  if ((countRes.results?.[0]?.c ?? 0) >= FOUNDING_CAP) return badRequest(`Founding cap of ${FOUNDING_CAP} already reached`);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO founding_members (id, company_id, amount_paid, payment_reference, notes, marked_by, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(id, company.id, amountPaid || null, paymentReference || null, notes || null, email).run();
  await env.DB.prepare(`UPDATE companies SET status = 'founding', updated_at = datetime('now') WHERE id = ?`).bind(company.id).run();
  return json({ slug, status: "founding" }, 201);
}

async function handleAdminUnmarkFounding(slug, request, env) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const companyRes = await env.DB.prepare(`SELECT id, status FROM companies WHERE slug = ?`).bind(slug).all();
  if (!companyRes.results?.length) return notFound("Company not found");
  const company = companyRes.results[0];
  if (company.status !== "founding") return badRequest("Company is not currently a founding member");
  await env.DB.prepare(`UPDATE companies SET status = 'claimed', updated_at = datetime('now') WHERE id = ?`).bind(company.id).run();
  return json({ slug, status: "claimed" });
}

const TRACKABLE_EVENTS = ["search", "company_view", "enquiry_cta_click", "enquiry_submitted", "claim_submitted", "founding_cta_click", "account_view"];

async function handleTrack(request, env) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }
  const { eventType, companySlug, meta, visitorId, sessionId, path } = body;
  if (!TRACKABLE_EVENTS.includes(eventType)) return badRequest("Unknown eventType");
  const id = crypto.randomUUID();
  let metaStr = null;
  if (meta != null) {
    try { metaStr = JSON.stringify(meta).slice(0, 2000); } catch { metaStr = null; }
  }
  await env.DB.prepare(
    `INSERT INTO analytics_events (id, event_type, company_slug, meta, visitor_id, session_id, path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(id, eventType, companySlug || null, metaStr, visitorId || null, sessionId || null, path || null).run();
  return json({ ok: true }, 201);
}

async function handleSessionStart(request, env) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }
  const { sessionId, visitorId, landingPage, referrer, utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = body;
  if (!sessionId || !visitorId) return badRequest("sessionId and visitorId are required");
  await env.DB.prepare(
    `INSERT OR IGNORE INTO sessions (session_id, visitor_id, landing_page, referrer, utm_source, utm_medium, utm_campaign, utm_term, utm_content, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(sessionId, visitorId, landingPage || null, referrer || null, utmSource || null, utmMedium || null, utmCampaign || null, utmTerm || null, utmContent || null).run();
  return json({ ok: true }, 201);
}

async function handleIdentify(request, env) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }
  const { visitorId, email } = body;
  if (!visitorId || !email) return badRequest("visitorId and email are required");
  await env.DB.prepare(
    `INSERT OR IGNORE INTO visitor_identities (visitor_id, user_email, first_identified_at) VALUES (?, ?, datetime('now'))`
  ).bind(visitorId, email).run();
  return json({ ok: true }, 201);
}

async function handleAdminAnalytics(url, request, env) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const days = Math.min(parseInt(url.searchParams.get("days") || "30", 10), 90);
  const since = `-${days} days`;

  const countsRes = await env.DB.prepare(
    `SELECT event_type, COUNT(*) as c FROM analytics_events WHERE created_at >= datetime('now', ?) GROUP BY event_type`
  ).bind(since).all();
  const counts = {};
  (countsRes.results || []).forEach(r => { counts[r.event_type] = r.c; });

  const topCompaniesRes = await env.DB.prepare(
    `SELECT company_slug, COUNT(*) as c FROM analytics_events WHERE event_type = 'company_view' AND company_slug IS NOT NULL AND created_at >= datetime('now', ?) GROUP BY company_slug ORDER BY c DESC LIMIT 10`
  ).bind(since).all();

  const searchRes = await env.DB.prepare(
    `SELECT meta FROM analytics_events WHERE event_type = 'search' AND created_at >= datetime('now', ?) ORDER BY created_at DESC LIMIT 500`
  ).bind(since).all();
  const queryCounts = {};
  (searchRes.results || []).forEach(r => {
    try {
      const m = JSON.parse(r.meta || "{}");
      const q = (m.q || "").trim().toLowerCase();
      if (q) queryCounts[q] = (queryCounts[q] || 0) + 1;
    } catch {}
  });
  const topQueries = Object.entries(queryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([q, c]) => ({ query: q, count: c }));

  const uniqueVisitorsRes = await env.DB.prepare(
    `SELECT COUNT(DISTINCT visitor_id) as c FROM analytics_events WHERE visitor_id IS NOT NULL AND created_at >= datetime('now', ?)`
  ).bind(since).all();
  const uniqueSessionsRes = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM sessions WHERE started_at >= datetime('now', ?)`
  ).bind(since).all();
  const identifiedRes = await env.DB.prepare(
    `SELECT COUNT(DISTINCT visitor_id) as c FROM visitor_identities WHERE first_identified_at >= datetime('now', ?)`
  ).bind(since).all();

  const topLandingRes = await env.DB.prepare(
    `SELECT landing_page, COUNT(*) as c FROM sessions WHERE started_at >= datetime('now', ?) AND landing_page IS NOT NULL GROUP BY landing_page ORDER BY c DESC LIMIT 10`
  ).bind(since).all();
  const topSourceRes = await env.DB.prepare(
    `SELECT COALESCE(utm_source, CASE WHEN referrer IS NULL OR referrer = '' THEN 'direct' ELSE referrer END) as source, COUNT(*) as c
     FROM sessions WHERE started_at >= datetime('now', ?) GROUP BY source ORDER BY c DESC LIMIT 10`
  ).bind(since).all();

  return json({
    days,
    counts,
    uniqueVisitors: uniqueVisitorsRes.results?.[0]?.c ?? 0,
    sessions: uniqueSessionsRes.results?.[0]?.c ?? 0,
    identifiedVisitors: identifiedRes.results?.[0]?.c ?? 0,
    topCompanies: (topCompaniesRes.results || []).map(r => ({ slug: r.company_slug, views: r.c })),
    topQueries,
    topLandingPages: (topLandingRes.results || []).map(r => ({ page: r.landing_page, count: r.c })),
    topSources: (topSourceRes.results || []).map(r => ({ source: r.source, count: r.c })),
  });
}

async function handlePublicStats(env) {
  const days = 30;
  const since = `-${days} days`;
  const totalRes = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM analytics_events WHERE event_type = 'search' AND created_at >= datetime('now', ?)`
  ).bind(since).all();
  const uniqueRes = await env.DB.prepare(
    `SELECT COUNT(DISTINCT visitor_id) as c FROM analytics_events WHERE event_type = 'search' AND visitor_id IS NOT NULL AND created_at >= datetime('now', ?)`
  ).bind(since).all();
  const rawRes = await env.DB.prepare(
    `SELECT meta FROM analytics_events WHERE event_type = 'search' AND created_at >= datetime('now', ?) ORDER BY created_at DESC LIMIT 500`
  ).bind(since).all();
  const queryCounts = {};
  (rawRes.results || []).forEach(r => {
    try {
      const m = JSON.parse(r.meta || "{}");
      const q = (m.q || "").trim();
      if (q) queryCounts[q] = (queryCounts[q] || 0) + 1;
    } catch {}
  });
  const top = Object.entries(queryCounts).sort((a, b) => b[1] - a[1])[0] || null;
  return json({
    days,
    totalSearches: totalRes.results?.[0]?.c ?? 0,
    uniqueSearchers: uniqueRes.results?.[0]?.c ?? 0,
    topQuery: top ? top[0] : null,
    topQueryCount: top ? top[1] : 0,
  });
}

async function requireOwnerEmail(request) {
  const auth = await requireUser(request);
  if (!auth) return { error: json({ error: "Unauthorized" }, 401) };
  if (!auth.email) {
    return { error: json({ error: "Your session token doesn't include an email — ask the site owner to add an email claim in Clerk (Sessions > Edit token)." }, 403) };
  }
  return { email: auth.email };
}

async function getOwnedCompanyBySlug(email, slug, env) {
  const userRes = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).all();
  if (!userRes.results?.length) return { error: json({ error: "No SpecGrid account found for this email" }, 404) };
  const userId = userRes.results[0].id;
  const { results } = await env.DB.prepare(
    `SELECT c.* FROM company_claims cc JOIN companies c ON c.id = cc.company_id WHERE cc.user_id = ? AND c.slug = ? AND cc.status = 'approved' ORDER BY cc.created_at DESC LIMIT 1`
  ).bind(userId, slug).all();
  if (!results?.length) return { error: json({ error: "You don't have an approved claim on this company" }, 403) };
  return { company: results[0], userId };
}

async function handleMyCompany(slug, request, env) {
  const { email, error } = await requireOwnerEmail(request);
  if (error) return error;
  const { company, error: err2 } = await getOwnedCompanyBySlug(email, slug, env);
  if (err2) return err2;
  const out = serializePublicCompany(company);
  const certsRes = await env.DB.prepare(`SELECT id, name, issuing_body, valid_until, verified FROM certifications WHERE company_id = ?`).bind(company.id).all();
  out.certifications = (certsRes.results || []).map(serializeCertification);
  return json(out);
}

const EDITABLE_COMPANY_FIELDS = {
  description: "description",
  website: "website",
  foundedYear: "founded_year",
  employeeBand: "employee_band",
  whatsappNumber: "whatsapp_number",
  locationCity: "location_city",
  locationState: "location_state",
  companyType: "company_type",
  logoUrl: "logo_url",
};

async function handlePatchMyCompany(slug, request, env) {
  const { email, error } = await requireOwnerEmail(request);
  if (error) return error;
  const { company, error: err2 } = await getOwnedCompanyBySlug(email, slug, env);
  if (err2) return err2;
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }

  const sets = [];
  const binds = [];
  for (const [key, column] of Object.entries(EDITABLE_COMPANY_FIELDS)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    let val = body[key];
    if (val === "") val = null;
    if (key === "foundedYear" && val != null) {
      val = parseInt(val, 10);
      if (Number.isNaN(val)) return badRequest("foundedYear must be a number");
    }
    if (key === "website" && val) {
      if (!/^https?:\/\//.test(val)) val = `https://${val}`;
    }
    sets.push(`${column} = ?`);
    binds.push(val);
  }
  if (!sets.length) return badRequest("No editable fields provided");
  binds.push(company.id);
  await env.DB.prepare(`UPDATE companies SET ${sets.join(", ")}, updated_at = datetime('now') WHERE id = ?`).bind(...binds).run();
  const { results } = await env.DB.prepare(`SELECT ${PUBLIC_COMPANY_FIELDS} FROM companies WHERE id = ?`).bind(company.id).all();
  return json(serializePublicCompany(results[0]));
}

async function handleBuyerIntent(slug, request, env) {
  const { email, error } = await requireOwnerEmail(request);
  if (error) return error;
  const { company, error: err2 } = await getOwnedCompanyBySlug(email, slug, env);
  if (err2) return err2;

  const days = 30;
  const since = `-${days} days`;

  const viewsRes = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM analytics_events WHERE event_type = 'company_view' AND company_slug = ? AND created_at >= datetime('now', ?)`
  ).bind(slug, since).all();

  const categoryId = company.category_id;
  let categorySearches = 0;
  const queryCounts = {};
  if (categoryId) {
    const searchRes = await env.DB.prepare(
      `SELECT meta FROM analytics_events WHERE event_type = 'search' AND created_at >= datetime('now', ?) ORDER BY created_at DESC LIMIT 1000`
    ).bind(since).all();
    (searchRes.results || []).forEach(r => {
      try {
        const m = JSON.parse(r.meta || "{}");
        if (m.category === categoryId) {
          categorySearches++;
          const q = (m.q || "").trim().toLowerCase();
          if (q) queryCounts[q] = (queryCounts[q] || 0) + 1;
        }
      } catch {}
    });
  }
  const topQueriesInCategory = Object.entries(queryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([q, c]) => ({ query: q, count: c }));

  return json({
    days,
    profileViews: viewsRes.results?.[0]?.c ?? 0,
    categorySearches,
    topQueriesInCategory,
    hasEnoughData: categorySearches > 0 || (viewsRes.results?.[0]?.c ?? 0) > 0,
  });
}

async function handlePostCertification(slug, request, env) {
  const { email, error } = await requireOwnerEmail(request);
  if (error) return error;
  const { company, error: err2 } = await getOwnedCompanyBySlug(email, slug, env);
  if (err2) return err2;
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }
  const { name, issuingBody, validUntil } = body;
  if (!name) return badRequest("name is required");
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO certifications (id, company_id, name, issuing_body, valid_until, verified) VALUES (?, ?, ?, ?, ?, 0)`
  ).bind(id, company.id, name, issuingBody || null, validUntil || null).run();
  return json({ id, name, issuingBody: issuingBody || null, validUntil: validUntil || null, verified: false }, 201);
}

async function handleDeleteCertification(certId, slug, request, env) {
  const { email, error } = await requireOwnerEmail(request);
  if (error) return error;
  const { company, error: err2 } = await getOwnedCompanyBySlug(email, slug, env);
  if (err2) return err2;
  const certRes = await env.DB.prepare(`SELECT company_id FROM certifications WHERE id = ?`).bind(certId).all();
  if (!certRes.results?.length) return notFound("Certification not found");
  if (certRes.results[0].company_id !== company.id) return json({ error: "This certification doesn't belong to your company" }, 403);
  await env.DB.prepare(`DELETE FROM certifications WHERE id = ?`).bind(certId).run();
  return json({ id: certId, deleted: true });
}

function serializeEnquiry(r) {
  let parsed = {};
  try { parsed = JSON.parse(r.message || "{}"); } catch {}
  return {
    id: r.id, companyId: r.company_id, buyerName: r.buyer_name,
    buyerEmail: r.buyer_email, buyerPhone: r.buyer_phone,
    message: parsed.message ?? r.message, industry: parsed.industry ?? null, urgency: parsed.urgency ?? null,
    subject: parsed.subject ?? null, responseBy: parsed.responseBy ?? null,
    status: r.status, createdAt: r.created_at,
  };
}

async function getOwnedCompanies(userId, env) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.slug, c.name FROM company_claims cc JOIN companies c ON c.id = cc.company_id WHERE cc.user_id = ? AND cc.status = 'approved'`
  ).bind(userId).all();
  return results || [];
}

async function handleMyEnquiries(request, env) {
  const { email, error } = await requireOwnerEmail(request);
  if (error) return error;
  const userRes = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).all();
  if (!userRes.results?.length) return json({ results: [], companies: [] });
  const companies = await getOwnedCompanies(userRes.results[0].id, env);
  if (!companies.length) return json({ results: [], companies: [] });
  const ids = companies.map(c => c.id);
  const placeholders = ids.map(() => "?").join(",");
  const enqRes = await env.DB.prepare(`SELECT * FROM enquiries WHERE company_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 100`).bind(...ids).all();
  return json({ results: (enqRes.results || []).map(serializeEnquiry), companies });
}

async function handleMyCompanyEnquiries(slug, request, env) {
  const { email, error } = await requireOwnerEmail(request);
  if (error) return error;
  const userRes = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).all();
  if (!userRes.results?.length) return json({ error: "No SpecGrid account found for this email" }, 404);
  const companyRes = await env.DB.prepare(
    `SELECT c.id FROM company_claims cc JOIN companies c ON c.id = cc.company_id WHERE cc.user_id = ? AND c.slug = ? AND cc.status = 'approved'`
  ).bind(userRes.results[0].id, slug).all();
  if (!companyRes.results?.length) return json({ error: "You don't have an approved claim on this company" }, 403);
  const enqRes = await env.DB.prepare(`SELECT * FROM enquiries WHERE company_id = ? ORDER BY created_at DESC LIMIT 100`).bind(companyRes.results[0].id).all();
  return json({ results: (enqRes.results || []).map(serializeEnquiry) });
}

async function handlePatchEnquiryStatus(id, request, env) {
  const { email, error } = await requireOwnerEmail(request);
  if (error) return error;
  let body;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON body"); }
  const { status } = body;
  if (!["new", "forwarded", "closed"].includes(status)) return badRequest("status must be one of new, forwarded, closed");
  const userRes = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).all();
  if (!userRes.results?.length) return json({ error: "No SpecGrid account found" }, 404);
  const enqRes = await env.DB.prepare(`SELECT company_id FROM enquiries WHERE id = ?`).bind(id).all();
  if (!enqRes.results?.length) return notFound("Enquiry not found");
  const companyId = enqRes.results[0].company_id;
  const ownRes = await env.DB.prepare(`SELECT 1 FROM company_claims WHERE user_id = ? AND company_id = ? AND status = 'approved'`).bind(userRes.results[0].id, companyId).all();
  if (!ownRes.results?.length) return json({ error: "You don't own this company's enquiries" }, 403);
  await env.DB.prepare(
    `UPDATE enquiries SET status = ?, forwarded_at = CASE WHEN ? = 'forwarded' THEN datetime('now') ELSE forwarded_at END WHERE id = ?`
  ).bind(status, status, id).run();
  return json({ id, status });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    if (method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
    try {
      if (pathname === "/api/companies" && method === "GET") return await handleListCompanies(url, env);
      if (pathname === "/api/filter-options" && method === "GET") return await handleFilterOptions(env);
      if (pathname === "/api/public-stats" && method === "GET") return await handlePublicStats(env);
      let m = pathname.match(/^\/api\/companies\/([a-z0-9-]+)$/);
      if (m && method === "GET") return await handleGetCompany(m[1], env);
      if (pathname === "/api/categories" && method === "GET") return await handleListCategories(env);
      m = pathname.match(/^\/api\/categories\/([a-z0-9-]+)$/);
      if (m && method === "GET") return await handleGetCategory(m[1], env);
      if (pathname === "/api/enquiry" && method === "POST") return await handlePostEnquiry(request, env);
      if (pathname === "/api/claim" && method === "POST") return await handlePostClaim(request, env);
      m = pathname.match(/^\/api\/claim\/([a-z0-9-]+)\/status$/);
      if (m && method === "GET") return await handleGetClaimStatus(m[1], env);
      m = pathname.match(/^\/api\/my-company\/([^/]+)$/);
      if (m && method === "GET") return await handleMyCompany(m[1], request, env);
      if (m && method === "PATCH") return await handlePatchMyCompany(m[1], request, env);
      if (pathname === "/api/my-enquiries" && method === "GET") return await handleMyEnquiries(request, env);
      m = pathname.match(/^\/api\/my-company\/([^/]+)\/enquiries$/);
      if (m && method === "GET") return await handleMyCompanyEnquiries(m[1], request, env);
      m = pathname.match(/^\/api\/my-company\/([^/]+)\/buyer-intent$/);
      if (m && method === "GET") return await handleBuyerIntent(m[1], request, env);
      m = pathname.match(/^\/api\/my-company\/([^/]+)\/certifications$/);
      if (m && method === "POST") return await handlePostCertification(m[1], request, env);
      m = pathname.match(/^\/api\/my-company\/([^/]+)\/certifications\/([^/]+)$/);
      if (m && method === "DELETE") return await handleDeleteCertification(m[2], m[1], request, env);
      m = pathname.match(/^\/api\/enquiries\/([^/]+)\/status$/);
      if (m && method === "PATCH") return await handlePatchEnquiryStatus(m[1], request, env);
      if (pathname === "/api/admin/claims" && method === "GET") return await handleAdminListClaims(url, request, env);
      m = pathname.match(/^\/api\/admin\/claims\/([^/]+)$/);
      if (m && method === "PATCH") return await handleAdminPatchClaim(m[1], request, env);
      if (pathname === "/api/admin/certifications" && method === "GET") return await handleAdminListCertifications(request, env);
      m = pathname.match(/^\/api\/admin\/certifications\/([^/]+)\/verify$/);
      if (m && method === "PATCH") return await handleAdminVerifyCertification(m[1], request, env);
      if (pathname === "/api/founding-count" && method === "GET") return await handleFoundingCount(env);
      m = pathname.match(/^\/api\/admin\/founding\/([a-z0-9-]+)$/);
      if (m && method === "POST") return await handleAdminMarkFounding(m[1], request, env);
      if (m && method === "DELETE") return await handleAdminUnmarkFounding(m[1], request, env);
      if (pathname === "/api/track" && method === "POST") return await handleTrack(request, env);
      if (pathname === "/api/session/start" && method === "POST") return await handleSessionStart(request, env);
      if (pathname === "/api/identify" && method === "POST") return await handleIdentify(request, env);
      if (pathname === "/api/admin/analytics" && method === "GET") return await handleAdminAnalytics(url, request, env);
      if (pathname === "/" || pathname === "/health") return json({ status: "ok", service: "specgrid-api", version: "P9" });
      return notFound();
    } catch (err) {
      return json({ error: "Internal error", detail: String(err) }, 500);
    }
  },
};
