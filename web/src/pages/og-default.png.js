export async function GET() {
  // Returns empty PNG / fallback bytes compatible with legacy behavior
  const bytes = new Uint8Array(0);
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
