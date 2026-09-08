// Server-side tracking helper preserving P8 analytics continuity

const API_BASE = "https://specgrid-api.mathispaceboy.workers.dev";

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[1]) : null;
}

export function trackServer(request, eventType, companySlug = null, meta = null, locals = null) {
  const visitorId = getCookie(request, "sg_vid");
  const sessionId = getCookie(request, "sg_sid");
  const path = new URL(request.url).pathname;

  const promise = fetch(`${API_BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType,
      companySlug: companySlug || null,
      meta: meta || null,
      visitorId,
      sessionId,
      path,
    }),
  }).catch(() => {});

  if (locals?.runtime?.ctx?.waitUntil) {
    locals.runtime.ctx.waitUntil(promise);
  }
}
