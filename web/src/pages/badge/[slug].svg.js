const API_BASE = "https://specgrid-api.mathispaceboy.workers.dev";

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET({ params }) {
  const { slug } = params;

  let co = null;
  try {
    const res = await fetch(`${API_BASE}/api/companies/${encodeURIComponent(slug)}`);
    if (res.ok) {
      co = await res.json();
    }
  } catch (e) {}

  const companyName = co ? (co.name.length > 24 ? co.name.slice(0, 22) + "…" : co.name) : "Industrial Supplier";
  const specId = co ? (co.specId || `SPEC-${(co.id || "000000").slice(0, 6).toUpperCase()}`) : "SPEC-INDEX";

  let statusText = "INDEXED PROFILE";
  let statusColor = "#62747E";
  let statusBg = "rgba(98, 116, 126, 0.12)";
  let dotColor = "#62747E";

  if (co) {
    if (co.status === "founding") {
      statusText = "FOUNDING MEMBER";
      statusColor = "#B87A1E";
      statusBg = "rgba(226, 163, 59, 0.15)";
      dotColor = "#E2A33B";
    } else if (co.status === "verified" || co.verificationTier === "manual_reviewed") {
      statusText = "VERIFIED SUPPLIER";
      statusColor = "#1F6F4A";
      statusBg = "rgba(31, 111, 74, 0.12)";
      dotColor = "#1F6F4A";
    } else if (co.status === "claimed") {
      statusText = "CLAIMED PROFILE";
      statusColor = "#14242E";
      statusBg = "rgba(20, 36, 46, 0.08)";
      dotColor = "#14242E";
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="64" viewBox="0 0 320 64" fill="none" role="img" aria-label="SpecGrid - ${esc(companyName)}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&amp;family=Space+Grotesk:wght@600;700&amp;display=swap');
      .title { font-family: 'Space Grotesk', -apple-system, sans-serif; font-size: 13.5px; font-weight: 700; fill: #14242E; letter-spacing: -0.01em; }
      .meta { font-family: 'IBM Plex Mono', monospace; font-size: 9.5px; font-weight: 500; fill: #62747E; letter-spacing: 0.04em; }
      .badge-text { font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; font-weight: 600; fill: ${statusColor}; letter-spacing: 0.06em; }
    </style>
    <filter id="shadow" x="0" y="0" width="320" height="64" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#14242E" flood-opacity="0.06"/>
    </filter>
  </defs>

  <!-- Background Card -->
  <rect x="1" y="1" width="318" height="62" rx="7" fill="#F4F5F1" stroke="#CAD2D0" stroke-width="1" filter="url(#shadow)"/>

  <!-- Left Accent Bar -->
  <path d="M1 8 C1 4.13 4.13 1 8 1 L8 63 C4.13 63 1 59.87 1 56 Z" fill="${dotColor}"/>

  <!-- 3x3 SpecGrid Grid Icon -->
  <g transform="translate(18, 18)">
    <rect x="0" y="0" width="7" height="7" rx="1.5" fill="#14242E"/>
    <rect x="9.5" y="0" width="7" height="7" rx="1.5" fill="#14242E"/>
    <rect x="19" y="0" width="7" height="7" rx="1.5" fill="#14242E"/>
    <rect x="0" y="9.5" width="7" height="7" rx="1.5" fill="#14242E"/>
    <rect x="9.5" y="9.5" width="7" height="7" rx="1.5" fill="#1F6F4A"/>
    <rect x="19" y="9.5" width="7" height="7" rx="1.5" fill="#14242E"/>
    <rect x="0" y="19" width="7" height="7" rx="1.5" fill="#14242E"/>
    <rect x="9.5" y="19" width="7" height="7" rx="1.5" fill="#14242E"/>
    <rect x="19" y="19" width="7" height="7" rx="1.5" fill="#14242E"/>
  </g>

  <!-- SpecGrid Meta Line -->
  <text x="56" y="24" class="meta">SPECGRID // ${esc(specId)}</text>

  <!-- Company Title -->
  <text x="56" y="43" class="title">${esc(companyName)}</text>

  <!-- Status Pill -->
  <rect x="204" y="21" width="104" height="22" rx="4" fill="${statusBg}" stroke="${statusColor}" stroke-opacity="0.25" stroke-width="1"/>
  <circle cx="214" cy="32" r="3" fill="${dotColor}"/>
  <text x="222" y="35" class="badge-text">${statusText}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=UTF-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
