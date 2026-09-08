export async function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /account
Disallow: /claim/
Disallow: /enquire/

Sitemap: https://specgrid.in/sitemap.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
