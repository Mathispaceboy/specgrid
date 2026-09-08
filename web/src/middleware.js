import legacyWorker from './legacy/legacyWorker.js';

// Set of route paths that have been migrated to Astro.
// In Phase 1, only the design test / preview route is in Astro.
// Future phases will add: '/about', '/terms', '/privacy', '/data-disclaimer', '/for-suppliers', '/', etc.
export const MIGRATED_ROUTES = new Set([
  // Phase 2: Static Editorial & Legal Pages
  '/about',
  '/terms',
  '/privacy',
  '/data-disclaimer',
  // Phase 3: Marketing & Conversion Pages
  '/',
  '/for-suppliers',
  // Phase 4: Directory & Company Profiles
  '/search',
  // Phase 6: Authenticated Portals & Admin
  '/account',
  '/admin',
  // Phase 7: Utility Endpoints & System
  '/robots.txt',
  '/sitemap.xml',
  '/og-default.png',
  '/404',
]);

function isMigrated(pathname) {
  let p = pathname || '/';
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  if (p === '') p = '/';
  if (MIGRATED_ROUTES.has(p)) return true;
  if (p.startsWith('/companies/')) return true;
  // Phase 5: Lead Capture Forms
  if (p.startsWith('/enquire/')) return true;
  if (p.startsWith('/claim/')) return true;
  // Phase 6: Account Edit
  if (p.startsWith('/account/edit/')) return true;
  // P9C: Embeddable Badges
  if (p.startsWith('/badge/')) return true;
  // API Routes (e.g. /api/admin/create-company)
  if (p.startsWith('/api/')) return true;
  return false;
}

function injectNoIndex(html) {
  const metaTag = '<meta name="robots" content="noindex, nofollow">';
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>${metaTag}`);
  }
  return `${metaTag}${html}`;
}

export async function onRequest(context, next) {
  const url = new URL(context.request.url);
  let { pathname } = url;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  if (pathname.startsWith('/companies/') && pathname.endsWith('.html')) {
    pathname = pathname.slice(0, -5);
  }

  const isLegacyExplicit = url.searchParams.get('version') === 'legacy';
  const hasAstroPage = isMigrated(pathname);

  // Cloudflare runtime bindings from @astrojs/cloudflare
  const runtime = context.locals?.runtime || {};
  const env = runtime.env || {};
  const ctx = runtime.ctx || { waitUntil: () => {} };

  // If user explicitly asks for ?version=legacy OR the page has not been migrated to Astro yet:
  if (isLegacyExplicit || !hasAstroPage) {
    const legacyResponse = await legacyWorker.fetch(context.request, env, ctx);

    // If this was an explicit ?version=legacy request, ensure it is NEVER indexed by search engines
    if (isLegacyExplicit) {
      const contentType = legacyResponse.headers.get('content-type') || '';
      const headers = new Headers(legacyResponse.headers);
      headers.set('X-Robots-Tag', 'noindex, nofollow');

      if (contentType.includes('text/html')) {
        const text = await legacyResponse.text();
        const updatedHtml = injectNoIndex(text);
        return new Response(updatedHtml, {
          status: legacyResponse.status,
          statusText: legacyResponse.statusText,
          headers,
        });
      }

      return new Response(legacyResponse.body, {
        status: legacyResponse.status,
        statusText: legacyResponse.statusText,
        headers,
      });
    }

    return legacyResponse;
  }

  // Route is migrated to Astro and legacy version was not requested
  return next();
}
