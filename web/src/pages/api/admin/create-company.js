function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(context) {
  const runtime = context.locals?.runtime || {};
  const db = runtime.env?.DB;

  if (!db) {
    return new Response(
      JSON.stringify({ error: 'Database binding (DB) is unavailable on this worker runtime.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON request payload.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const name = (body.name || '').trim();
  if (!name) {
    return new Response(
      JSON.stringify({ error: 'Company name is required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const categoryId = (body.categoryId || '').trim();
  if (!categoryId) {
    return new Response(
      JSON.stringify({ error: 'Category is required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let rawSlug = (body.slug || '').trim();
  if (!rawSlug) {
    rawSlug = slugify(name);
  } else {
    rawSlug = slugify(rawSlug);
  }
  if (!rawSlug) rawSlug = 'company-' + Math.floor(1000 + Math.random() * 9000);

  // Ensure slug uniqueness
  let finalSlug = rawSlug;
  try {
    const { results } = await db.prepare('SELECT id FROM companies WHERE slug = ?').bind(finalSlug).all();
    if (results && results.length > 0) {
      finalSlug = `${rawSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  } catch (err) {
    console.error('Slug check error:', err);
  }

  // Determine next spec_id
  let specId = 'SPEC-1300';
  try {
    const { results } = await db.prepare("SELECT spec_id FROM companies WHERE spec_id LIKE 'SPEC-%' ORDER BY spec_id DESC LIMIT 1").all();
    if (results && results.length > 0 && results[0].spec_id) {
      const match = results[0].spec_id.match(/SPEC-(\d+)/);
      if (match && match[1]) {
        const nextNum = parseInt(match[1], 10) + 1;
        specId = `SPEC-${nextNum}`;
      }
    }
  } catch (err) {
    console.error('Spec ID generation error:', err);
  }


  const id = crypto.randomUUID();
  const companyType = ['manufacturer', 'trader_distributor', 'service_provider', 'epc_contractor', 'other'].includes(body.companyType)
    ? body.companyType
    : 'manufacturer';
  const locationCity = (body.locationCity || 'Coimbatore').trim();
  const locationState = (body.locationState || 'Tamil Nadu').trim();
  const foundedYear = body.foundedYear ? parseInt(body.foundedYear, 10) : null;
  const employeeBand = (body.employeeBand || '').trim() || null;
  const description = (body.description || '').trim();
  const website = (body.website || '').trim() || null;
  const contactEmail = (body.contactEmail || '').trim() || null;
  const contactPhone = (body.contactPhone || '').trim() || null;
  const whatsappNumber = (body.whatsappNumber || '').trim() || null;
  const sourceNote = (body.sourceNote || 'CODISSIA Inter Die Casting Expo 2026').trim();
  const status = ['verified', 'founding', 'draft'].includes(body.status) ? body.status : 'verified';

  try {
    const statements = [
      db.prepare(`
        INSERT INTO companies (
          id, slug, name, status, category_id, company_type, public_visible,
          location_city, location_state, founded_year, employee_band,
          description, website, source_note, contact_email, contact_phone,
          spec_id, whatsapp_number, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        id,
        finalSlug,
        name,
        status,
        categoryId,
        companyType,
        locationCity,
        locationState,
        foundedYear,
        employeeBand,
        description,
        website,
        sourceNote,
        contactEmail,
        contactPhone,
        specId,
        whatsappNumber
      )
    ];

    // Handle Certifications
    if (Array.isArray(body.certifications)) {
      for (const cert of body.certifications) {
        const certName = typeof cert === 'string' ? cert.trim() : (cert?.name || '').trim();
        const issuingBody = typeof cert === 'object' && cert?.issuingBody ? cert.issuingBody.trim() : null;
        if (certName) {
          statements.push(
            db.prepare(`
              INSERT INTO certifications (id, company_id, name, issuing_body, verified)
              VALUES (?, ?, ?, ?, 1)
            `).bind(crypto.randomUUID(), id, certName, issuingBody)
          );
        }
      }
    }

    await db.batch(statements);

    return new Response(
      JSON.stringify({
        ok: true,
        id,
        slug: finalSlug,
        name,
        specId,
        status,
        profileUrl: `/companies/${finalSlug}`
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('Company creation error in D1:', err);
    return new Response(
      JSON.stringify({ error: `Database error creating company: ${err.message || String(err)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
