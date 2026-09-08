const SITE_URL = 'https://specgrid.in';
const API_BASE = 'https://specgrid-api.mathi-527.workers.dev';

function xmlEscape(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(context) {
  const runtime = context.locals?.runtime || {};
  const env = runtime.env || {};

  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/search`,
    `${SITE_URL}/for-suppliers`,
    `${SITE_URL}/about`,
    `${SITE_URL}/terms`,
    `${SITE_URL}/privacy`,
    `${SITE_URL}/data-disclaimer`,
  ];

  try {
    let res;
    if (env.API && typeof env.API.fetch === 'function') {
      res = await env.API.fetch(new Request(`${API_BASE}/api/companies?limit=250`));
    } else {
      res = await fetch(`${API_BASE}/api/companies?limit=250`);
    }

    if (res.ok) {
      const data = await res.json();
      const companies = data.results || [];
      for (const co of companies) {
        if (co.slug) {
          urls.push(`${SITE_URL}/companies/${co.slug}`);
        }
      }
    }
  } catch (err) {
    console.error('Sitemap fetch companies error:', err);
  }

  // Ensure NO query strings (e.g. ?version=legacy) ever appear in the sitemap
  const cleanUrls = urls
    .map(u => u.split('?')[0])
    .filter((u, i, arr) => arr.indexOf(u) === i);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${cleanUrls.map(u => `  <url><loc>${xmlEscape(u)}</loc></url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
