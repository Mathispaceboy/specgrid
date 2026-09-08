export async function GET() {
  const body = `User-agent: *
Allow: /
Sitemap: https://specgrid.in/sitemap.xml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
