const API_BASE = "https://specgrid-api.mathispaceboy.workers.dev";
const SITE_URL = "https://specgrid.in";

async function apiFetch(env, path) {
  if (env && env.API) return env.API.fetch(`https://internal${path}`);
  return fetch(`${API_BASE}${path}`);
}

// --- P8B: attribution (visitor_id / session_id) ---
// The client-side bootstrap script (TRACKING_BOOTSTRAP, injected into every
// page by shell()) sets two plain (non-httpOnly) cookies on first visit:
//   sg_vid — a random UUID, 2-year expiry, identifies the same browser across
//            every future visit ("visitor")
//   sg_sid — a random UUID, session cookie (no explicit expiry — cleared when
//            the browser session ends), identifies one continuous visit
// Because they're plain cookies (not localStorage-only), server-rendered
// route handlers below can read them straight off the incoming request and
// attach them to server-side tracking calls (company_view, search), so even
// a page load with JS disabled/blocked still gets attributed once the cookie
// exists. The one gap: the very first page of a brand new visitor's very
// first session has no cookie yet when that first server-side event fires
// (chicken-and-egg) — it will show visitor_id/session_id as null. Every
// subsequent page in that same visit, and everything after, is attributed.
function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp("(?:^|; )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function trackAsync(env, ctx, eventType, companySlug, meta, request) {
  const visitorId = request ? getCookie(request, "sg_vid") : null;
  const sessionId = request ? getCookie(request, "sg_sid") : null;
  const path = request ? new URL(request.url).pathname : null;
  const p = fetch(`${API_BASE}/api/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, companySlug: companySlug || null, meta: meta || null, visitorId, sessionId, path }),
  }).catch(() => {});
  if (ctx && ctx.waitUntil) ctx.waitUntil(p);
}

// Injected into every page via shell(). Establishes sg_vid/sg_sid cookies,
// fires POST /api/session/start exactly once per browser session (capturing
// landing page, referrer, and any UTM params present on that first page),
// and exposes window.__sg = {visitorId, sessionId, track(eventType, companySlug, meta)}
// for every page's own inline scripts to call for client-side interaction
// events (clicks, form submits). See the "Attribution & Analytics" reference
// doc for the full event/field catalogue and how to add a new tracked event.
const TRACKING_BOOTSTRAP = `<script>(function(){
function uuid(){try{return crypto.randomUUID();}catch(e){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c=='x'?r:(r&0x3|0x8);return v.toString(16);});}}
function getCookie(name){var m=document.cookie.match(new RegExp('(?:^|; )'+name+'=([^;]+)'));return m?decodeURIComponent(m[1]):null;}
function setCookie(name,value,maxAgeSeconds){document.cookie=name+'='+encodeURIComponent(value)+';path=/;max-age='+maxAgeSeconds+';SameSite=Lax';}
var vid = getCookie('sg_vid');
if(!vid){ vid = uuid(); setCookie('sg_vid', vid, 63072000); }
else { setCookie('sg_vid', vid, 63072000); }
var sid = sessionStorage.getItem('sg_sid');
var isNewSession = false;
if(!sid){ sid = uuid(); sessionStorage.setItem('sg_sid', sid); isNewSession = true; }
setCookie('sg_sid', sid, 1800);
window.__sg = {
  visitorId: vid,
  sessionId: sid,
  track: function(eventType, companySlug, meta){
    try{
      fetch("${API_BASE}/api/track", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: eventType, companySlug: companySlug || null, meta: meta || null, visitorId: vid, sessionId: sid, path: location.pathname }) });
    }catch(e){}
  },
  identify: function(email){
    if(!email) return;
    if(sessionStorage.getItem('sg_identified') === email) return;
    try{
      fetch("${API_BASE}/api/identify", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: vid, email: email }) });
      sessionStorage.setItem('sg_identified', email);
    }catch(e){}
  }
};
if(isNewSession){
  var params = new URLSearchParams(location.search);
  try{
    fetch("${API_BASE}/api/session/start", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid, visitorId: vid,
        landingPage: location.pathname,
        referrer: document.referrer || null,
        utmSource: params.get("utm_source"), utmMedium: params.get("utm_medium"),
        utmCampaign: params.get("utm_campaign"), utmTerm: params.get("utm_term"), utmContent: params.get("utm_content"),
      })
    });
  }catch(e){}
}
})();<\/script>`;

// v8 design pass: palette extended (green-pale/amber/amber-pale trust tiers), icon
// mark added to logo, status badges differentiated (.tbadge), enquiry form lightened
// (.enquiry-box), category chip language unified (.chip/.flink), skeleton loading
// (.skel), search sidebar collapses to single column below 720px. OG_IMAGE_B64 below
// still reflects the pre-v8 mark — regenerate once the icon mark design is finalized.
//
// NOTE (fresh-repo migration, Sept 2026): the original production Worker embeds
// the full branded PNG as a ~9KB base64 string here. That exact binary payload
// was not re-transcribed into this repo (transcription risk on a huge base64
// blob is worse than just regenerating it). Before deploying from this repo,
// either (a) fetch the live PNG from https://specgrid.in/og-default.png and
// re-embed it as base64 here, or (b) generate a fresh OG image. The site works
// without it — /og-default.png just 404s until this is filled in.
const OG_IMAGE_B64 = "";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const STYLE = `
:root{--ink:#151c17;--ink-soft:#4b564e;--ink-faint:#8a9188;--green:#2f7d4f;--green-deep:#1f5c39;--green-pale:#eaf3ec;--amber:#b8853a;--amber-deep:#8a5a1e;--amber-pale:#f7eee0;--paper:#fbfaf6;--card:#fff;--line:#e6e2d6;--line-soft:#efece2;--mono:'SFMono-Regular',Consolas,Menlo,monospace}
@keyframes sgShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
.skel{background:linear-gradient(90deg,var(--line-soft) 0%,#e2ded0 50%,var(--line-soft) 100%);background-size:800px 100%;animation:sgShimmer 1.6s infinite linear;border-radius:6px}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;background:var(--paper);color:var(--ink)}
a{color:inherit}
.wrap{max-width:1100px;margin:0 auto;padding:0 28px}
header{display:flex;align-items:center;justify-content:space-between;padding:22px 0;flex-wrap:wrap;gap:12px}
.logo{font-weight:800;font-size:19px;letter-spacing:-.3px;text-decoration:none;color:var(--ink);display:inline-flex;align-items:center;gap:8px}
.logo span{color:var(--green)}
.logo svg{flex-shrink:0}
nav{display:flex;gap:26px;font-size:14px;color:var(--ink-soft)}
nav a{text-decoration:none}
.cta{background:var(--ink);color:#fff;padding:9px 17px;border-radius:7px;font-size:13.5px;font-weight:600;text-decoration:none;white-space:nowrap}
footer{padding:26px 0 34px;font-size:12.5px;color:#8f8a7a;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid var(--line-soft);margin-top:40px}
footer a{color:var(--ink-soft);text-decoration:none}
.hero{padding:64px 0 8px;text-align:center}
.kicker{font-family:var(--mono);font-size:11.5px;letter-spacing:1.2px;color:var(--green-deep);text-transform:uppercase;margin-bottom:16px;font-weight:700}
.hero h1{font-size:44px;line-height:1.12;margin:0 0 14px;font-weight:800;letter-spacing:-1px}
.hero p{color:var(--ink-soft);font-size:17px;max-width:520px;margin:0 auto 36px;line-height:1.5}
.sform{max-width:660px;margin:0 auto;position:relative}
.sform input{width:100%;padding:19px 62px 19px 22px;font-size:16.5px;border:1.5px solid var(--line);border-radius:12px;outline:none;background:#fff}
.sform button{position:absolute;right:7px;top:7px;bottom:7px;width:46px;background:var(--green);border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px}
.chip{font-size:12.5px;padding:6px 13px;border:1px solid var(--line);border-radius:20px;color:var(--ink-soft);background:#fff;text-decoration:none;display:inline-flex;align-items:center}
.trust{display:flex;justify-content:center;gap:36px;flex-wrap:wrap;margin:38px 0 0;padding:18px 0;border-top:1px solid var(--line-soft)}
.ti{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink-soft)}
.ti b{color:var(--ink)}
.cats{padding:48px 0 20px}
.chead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:18px}
.chead h2{font-size:15px;font-weight:700;margin:0}
.chead a{font-size:13px;color:var(--green-deep);text-decoration:none;font-weight:600}
.tgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.tile{border:1px solid var(--line);background:var(--card);border-radius:11px;padding:18px;text-decoration:none;color:inherit;display:block}
.tile .n{font-size:14px;font-weight:700}
.tile .c{font-size:12px;color:var(--ink-soft);margin-top:5px}
.tile.sk{height:74px;background:linear-gradient(90deg,var(--line-soft) 0%,#e2ded0 50%,var(--line-soft) 100%);background-size:800px 100%;animation:sgShimmer 1.6s infinite linear;border:none}
.proof{padding:48px 0 56px}
.pcard{border:1px solid var(--line);background:var(--card);border-radius:14px;padding:28px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}
.peye{font-family:var(--mono);font-size:11px;color:var(--green-deep);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;font-weight:700}
.pcard h3{margin:0 0 6px;font-size:19px}
.pcard p{margin:0;color:var(--ink-soft);font-size:14px;line-height:1.5;max-width:480px}
.pills{display:flex;gap:8px;flex-wrap:wrap}
.pill{background:var(--line-soft);border-radius:7px;padding:8px 12px;font-size:12px;text-align:center;min-width:88px}
.pill .l{color:var(--ink-soft);font-size:10.5px;text-transform:uppercase;letter-spacing:.4px}
.pill .v{font-weight:700;margin-top:2px}
.ssec{padding:32px 0 8px}
.sform2{position:relative;margin-bottom:24px}
.sform2 input{width:100%;padding:15px 54px 15px 18px;font-size:15px;border:1.5px solid var(--line);border-radius:10px;outline:none;background:#fff}
.sform2 button{position:absolute;right:6px;top:6px;bottom:6px;width:40px;background:var(--green);border:none;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.sgrid{display:grid;grid-template-columns:220px 1fr;gap:28px;align-items:start}
@media (max-width:720px){.sgrid{grid-template-columns:1fr}}
.enquiry-box{border:none;background:transparent;padding:0}
.enquiry-box .fld{margin-bottom:18px}
.enquiry-box .fld label{font-weight:400;font-size:13px;color:var(--ink-soft);text-transform:none;letter-spacing:0}
.enquiry-box .fld input,.enquiry-box .fld textarea{border:none;border-bottom:1.5px solid var(--line);border-radius:0;padding:8px 0;background:transparent}
.enquiry-box .claim-submit{border-radius:9px}
.flabel{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin-bottom:10px}
.flink{font-size:12.5px;padding:6px 13px;border:1px solid var(--line);border-radius:20px;text-decoration:none;display:inline-flex;align-items:center;color:var(--ink-soft);background:#fff;margin:0 6px 6px 0}
.flink.active{color:var(--green-deep);font-weight:700;background:var(--green-pale);border-color:var(--green-pale)}
#catFilters{display:flex;flex-wrap:wrap}
.rmeta{font-size:13px;color:var(--ink-soft);margin-bottom:14px}
.rlist{display:flex;flex-direction:column;gap:12px}
.rcard{display:block;border:1px solid var(--line);background:var(--card);border-radius:11px;padding:16px 18px;text-decoration:none;color:inherit}
.rtop{display:flex;justify-content:space-between;align-items:start;gap:12px}
.rname{font-weight:700;font-size:15px}
.rloc{font-size:12.5px;color:var(--ink-soft);margin-top:3px}
.rbadge{font-size:11px;font-family:var(--mono);color:var(--green-deep);background:var(--line-soft);padding:4px 8px;border-radius:6px;white-space:nowrap}
.tbadge{font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
.tbadge.draft{border:1px solid var(--line);color:var(--ink-faint);background:transparent}
.tbadge.verified{background:var(--green-pale);color:var(--green-deep)}
.tbadge.founding{background:var(--amber-pale);color:var(--amber-deep)}
.rdesc{font-size:13px;color:var(--ink-soft);margin-top:8px;line-height:1.4}
.psec{padding:40px 0 56px}
.pback{font-size:13px;color:var(--ink-soft);text-decoration:none;display:inline-block;margin-bottom:18px}
.ptop{display:flex;justify-content:space-between;align-items:start;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.pname{font-size:30px;font-weight:800;margin:0 0 6px}
.ploc{color:var(--ink-soft);font-size:15px}
.psection{border:1px solid var(--line);background:var(--card);border-radius:12px;padding:22px;margin-bottom:16px}
.psection h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin:0 0 12px}
.certlist{display:flex;flex-direction:column;gap:8px}
.certitem{font-size:14px;display:flex;justify-content:space-between}
.notice{background:#fdf6e3;border:1px solid #eddba0;border-radius:10px;padding:14px 18px;font-size:13.5px;color:#6b5a1f;margin-bottom:20px}
.lp-hero{padding:56px 0 40px;text-align:center}
.lp-hero h1{font-size:36px;line-height:1.16;margin:0 0 14px;font-weight:800;letter-spacing:-.8px;max-width:680px;margin-left:auto;margin-right:auto}
.lp-hero p{color:var(--ink-soft);font-size:16px;max-width:560px;margin:0 auto 26px;line-height:1.55}
.lp-sec{padding:36px 0;border-top:1px solid var(--line-soft)}
.lp-sec h2{font-size:24px;margin:0 0 10px;font-weight:800;letter-spacing:-.4px}
.lp-sec .lead{color:var(--ink-soft);font-size:15px;max-width:640px;line-height:1.6;margin:0 0 22px}
.pain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.pain-card{border:1px solid var(--line);background:var(--card);border-radius:12px;padding:20px}
.pain-card h3{font-size:14.5px;margin:0 0 8px}
.pain-card p{font-size:13.5px;color:var(--ink-soft);margin:0;line-height:1.5}
.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.comp-card{border:1px solid var(--line);border-radius:12px;padding:22px;background:var(--card)}
.comp-card.bad{background:#fbf6f4}
.comp-card.good{border-color:var(--green);background:#f4faf6}
.comp-card h3{font-size:14px;text-transform:uppercase;letter-spacing:.4px;margin:0 0 14px}
.comp-card ul{margin:0;padding-left:18px;font-size:13.5px;color:var(--ink-soft);line-height:1.9}
.mockup{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:24px;max-width:560px}
.mockup .q{font-family:var(--mono);font-size:13px;background:var(--line-soft);border-radius:8px;padding:12px 14px;margin-bottom:14px}
.mockup .a{font-size:13.5px;line-height:1.7;color:var(--ink-soft)}
.mockup .cite{display:inline-block;margin-top:8px;font-family:var(--mono);font-size:11.5px;background:var(--green);color:#fff;padding:4px 9px;border-radius:6px}
.intel-card{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:24px;max-width:520px}
.intel-card .stat{font-size:26px;font-weight:800;color:var(--green-deep)}
.intel-card .lbl{font-size:13px;color:var(--ink-soft);margin-top:4px}
.founding-box{border:1.5px solid var(--green);border-radius:14px;background:#f4faf6;padding:30px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
.founding-box .n{font-size:34px;font-weight:800;color:var(--green-deep)}
.founding-box .l{font-size:13px;color:var(--ink-soft)}
.faq{display:flex;flex-direction:column;gap:10px;max-width:720px}
.faq-item{border:1px solid var(--line);border-radius:10px;padding:16px 18px;background:var(--card)}
.faq-item summary{font-weight:700;font-size:14.5px;cursor:pointer;list-style:none}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item p{margin:10px 0 0;font-size:13.5px;color:var(--ink-soft);line-height:1.6}
.legal h1{font-size:28px;margin:0 0 6px}
.legal .upd{font-size:12.5px;color:var(--ink-soft);margin-bottom:26px}
.legal h2{font-size:16px;margin:28px 0 8px}
.legal p,.legal li{font-size:14px;color:var(--ink-soft);line-height:1.7}
.legal ul{padding-left:20px}
.claim-box{max-width:480px;margin:0 auto;border:1px solid var(--line);background:var(--card);border-radius:14px;padding:30px}
.claim-box h1{font-size:22px;margin:0 0 6px}
.claim-box .sub{font-size:13.5px;color:var(--ink-soft);margin:0 0 22px;line-height:1.5}
.fld{margin-bottom:16px}
.fld label{display:block;font-size:12.5px;font-weight:700;color:var(--ink-soft);margin-bottom:6px;text-transform:uppercase;letter-spacing:.3px}
.fld input{width:100%;padding:12px 14px;font-size:14.5px;border:1.5px solid var(--line);border-radius:8px;outline:none;background:#fff}
.fld .hint{font-size:12px;color:var(--ink-soft);margin-top:5px}
.claim-submit{width:100%;background:var(--green);color:#fff;border:none;padding:13px;border-radius:8px;font-size:14.5px;font-weight:700;cursor:pointer;margin-top:6px}
.claim-msg{margin-top:16px;padding:12px 14px;border-radius:8px;font-size:13.5px;line-height:1.5;display:none}
.claim-msg.ok{background:#f4faf6;border:1px solid var(--green);color:var(--green-deep);display:block}
.claim-msg.err{background:#fdf1ee;border:1px solid #e8b3a4;color:#a3402a;display:block}
`;

function shell({ title, description, path, body, jsonLd, ogImage = null }) {
  const url = `${SITE_URL}${path}`;
  const img = ogImage || `${SITE_URL}/og-default.png`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${url}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:image" content="${esc(img)}"><meta property="og:site_name" content="SpecGrid"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(img)}">${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}<\/script>` : ""}<style>${STYLE}</style>${TRACKING_BOOTSTRAP}</head><body><div class="wrap"><header><a class="logo" href="/"><svg width="22" height="22" viewBox="0 0 24 24"><rect x="1" y="1" width="6.5" height="6.5" rx="1.3" fill="#151c17"/><rect x="8.75" y="1" width="6.5" height="6.5" rx="1.3" fill="#151c17"/><rect x="16.5" y="1" width="6.5" height="6.5" rx="1.3" fill="#151c17"/><rect x="1" y="8.75" width="6.5" height="6.5" rx="1.3" fill="#151c17"/><rect x="8.75" y="8.75" width="6.5" height="6.5" rx="1.3" fill="#2f7d4f"/><rect x="16.5" y="8.75" width="6.5" height="6.5" rx="1.3" fill="#151c17"/><rect x="1" y="16.5" width="6.5" height="6.5" rx="1.3" fill="#151c17"/><rect x="8.75" y="16.5" width="6.5" height="6.5" rx="1.3" fill="#151c17"/><rect x="16.5" y="16.5" width="6.5" height="6.5" rx="1.3" fill="#151c17"/></svg>Spec<span>Grid</span></a><nav><a href="/search">Categories</a><a href="/search">Directory</a><a href="/for-suppliers">For suppliers</a><a href="/account">Account</a></nav><a class="cta" href="/for-suppliers">List your company →</a></header>${body}<footer><span>SpecGrid · Coimbatore · © 2026 · <a href="/about">About</a></span><span><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/data-disclaimer">Data Disclaimer</a></span></footer></div></body></html>`;
}

function homepageHtml() {
  const body = `<section class="hero"><div class="kicker">India's technical manufacturer directory</div><h1>Find who actually makes it.</h1><p>Search by product, voltage class, IP rating or certification — and get real manufacturers, not ten identical-looking listing cards.</p><form class="sform" action="/search" method="get"><input name="q" type="text" autocomplete="off" placeholder="Try &quot;36kV VCB Coimbatore&quot; or &quot;IP65 solar inverter, ISO certified&quot;"><button type="submit" aria-label="Search"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="19" height="19"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button></form><div class="chips"><a class="chip" href="/search?category=switchgear-panels">Switchgear &amp; Panels</a><a class="chip" href="/search?category=transformers">Transformers</a><a class="chip" href="/search?category=solar-storage">Solar &amp; Storage</a><a class="chip" href="/search?category=ev-charging">EV &amp; Charging</a><a class="chip" href="/search?state=Tamil Nadu">Tamil Nadu</a></div></section><div class="trust"><div class="ti"><svg viewBox="0 0 24 24" fill="none" stroke="#2f7d4f" stroke-width="2.2" width="15" height="15"><path d="M20 6L9 17l-5-5"/></svg><b id="statCompanies">…</b>&nbsp;manufacturers indexed</div><div class="ti"><svg viewBox="0 0 24 24" fill="none" stroke="#2f7d4f" stroke-width="2.2" width="15" height="15"><path d="M20 6L9 17l-5-5"/></svg>Filterable by <b>voltage · IP rating · certification</b></div><div class="ti"><svg viewBox="0 0 24 24" fill="none" stroke="#2f7d4f" stroke-width="2.2" width="15" height="15"><path d="M20 6L9 17l-5-5"/></svg>No lead reselling — enquiries go direct</div></div><section class="cats"><div class="chead"><h2>Browse by category</h2><a href="/search">See all categories →</a></div><div id="tileGrid" class="tgrid"><div class="tile sk"></div><div class="tile sk"></div><div class="tile sk"></div><div class="tile sk"></div><div class="tile sk"></div></div></section><section class="proof"><div class="pcard"><div><div class="peye">What a real profile looks like</div><h3>Sky Power Switchgears — Salem, Tamil Nadu</h3><p>Compiled from the company's own public catalog. Buyers see exact specs before they ever pick up the phone.</p></div><div class="pills"><div class="pill"><div class="l">Panel type</div><div class="v">AIS, VCB, RMU</div></div><div class="pill"><div class="l">Voltage</div><div class="v">up to 36 kV</div></div><div class="pill"><div class="l">Testing</div><div class="v">IEC type-tested</div></div></div></div></section><script>(async()=>{try{const b="${API_BASE}";const[cr,pr]=await Promise.all([fetch(b+"/api/categories").then(r=>r.json()),fetch(b+"/api/companies?limit=1").then(r=>r.json())]);const cats=cr.results||[];document.getElementById("statCompanies").textContent=pr.total??"—";const g=document.getElementById("tileGrid");g.innerHTML="";cats.slice(0,10).forEach(c=>{const a=document.createElement("a");a.className="tile";a.href="/search?category="+encodeURIComponent(c.slug);a.innerHTML='<div class="n">'+c.name.replace(/</g,"&lt;")+'</div><div class="c">Browse '+c.name.replace(/</g,"&lt;").toLowerCase()+' →</div>';g.appendChild(a);});}catch(e){document.getElementById("tileGrid").innerHTML='<div style="grid-column:1/-1;color:#4b564e;font-size:13px;">Categories are temporarily unavailable.</div>';}})();<\/script>`;
  return shell({
    title: "SpecGrid — India's Technical Manufacturer Directory",
    description: "Search India's technical manufacturers by product, voltage class, IP rating, and certification. Real specs, not just names and phone numbers.",
    path: "/",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "SpecGrid",
      "url": SITE_URL + "/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": SITE_URL + "/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  });
}

function searchPageHtml() {
  const body = `<section class="ssec"><form class="sform2" action="/search" method="get"><input id="searchInput" name="q" type="text" autocomplete="off" placeholder="Search manufacturers, products, specs..."><button type="submit" aria-label="Search"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="17" height="17"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button></form><div class="sgrid"><aside><div class="flabel">Categories</div><div id="catFilters"><div class="skel" style="height:26px;width:90px;display:inline-block;margin:0 6px 6px 0;"></div><div class="skel" style="height:26px;width:120px;display:inline-block;margin:0 6px 6px 0;"></div><div class="skel" style="height:26px;width:80px;display:inline-block;margin:0 6px 6px 0;"></div></div><div class="flabel" style="margin-top:22px;">Company type</div><select id="typeFilter" style="width:100%;padding:9px 10px;font-size:13.5px;border:1.5px solid var(--line);border-radius:8px;background:#fff;margin-bottom:16px;"><option value="">All types</option></select><div class="flabel">State</div><select id="stateFilter" style="width:100%;padding:9px 10px;font-size:13.5px;border:1.5px solid var(--line);border-radius:8px;background:#fff;margin-bottom:16px;"><option value="">All states</option></select><label style="display:flex;align-items:center;gap:7px;font-size:13px;color:var(--ink-soft);cursor:pointer;"><input type="checkbox" id="certFilter">Has a certification on file</label></aside><div><div id="resultMeta" class="rmeta">Loading results…</div><div id="resultList" class="rlist"><div class="skel" style="height:70px;"></div><div class="skel" style="height:70px;"></div><div class="skel" style="height:70px;"></div></div></div></div></section><script>(async()=>{const b="${API_BASE}";const params=new URLSearchParams(window.location.search);const q=params.get("q")||"";const category=params.get("category")||"";const state=params.get("state")||"";const companyType=params.get("company_type")||"";const hasCert=params.get("has_certification")==="true";document.getElementById("searchInput").value=q;document.getElementById("certFilter").checked=hasCert;const typeLabels={manufacturer:"Manufacturer",trader_distributor:"Trader / Distributor",service_provider:"Service provider",epc_contractor:"EPC contractor",other:"Other"};function currentParams(){const p=new URLSearchParams();if(q)p.set("q",q);if(category)p.set("category",category);const t=document.getElementById("typeFilter").value;if(t)p.set("company_type",t);const st=document.getElementById("stateFilter").value;if(st)p.set("state",st);if(document.getElementById("certFilter").checked)p.set("has_certification","true");return p;}function applyFilters(){window.location.href="/search?"+currentParams().toString();}try{const opts=await fetch(b+"/api/filter-options").then(r=>r.json());const tf=document.getElementById("typeFilter");(opts.companyTypes||[]).forEach(t=>{const o=document.createElement("option");o.value=t;o.textContent=typeLabels[t]||t;if(t===companyType)o.selected=true;tf.appendChild(o);});const sf=document.getElementById("stateFilter");(opts.states||[]).forEach(s=>{const o=document.createElement("option");o.value=s;o.textContent=s;if(s===state)o.selected=true;sf.appendChild(o);});tf.addEventListener("change",applyFilters);sf.addEventListener("change",applyFilters);document.getElementById("certFilter").addEventListener("change",applyFilters);}catch(e){}try{const cats=await fetch(b+"/api/categories").then(r=>r.json());const cf=document.getElementById("catFilters");cf.innerHTML="";const all=document.createElement("a");const ap=currentParams();ap.delete("category");all.href="/search"+(ap.toString()?"?"+ap.toString():"");all.textContent="All categories";all.className="flink"+(!category?" active":"");cf.appendChild(all);(cats.results||[]).forEach(c=>{const a=document.createElement("a");const p=currentParams();p.set("category",c.slug);a.href="/search?"+p.toString();a.textContent=c.name;a.className="flink"+(category===c.slug?" active":"");cf.appendChild(a);});}catch(e){document.getElementById("catFilters").innerHTML='<div style="color:#4b564e;">Unavailable</div>';}try{const p=new URLSearchParams();if(q)p.set("q",q);if(category)p.set("category",category);if(state)p.set("state",state);if(companyType)p.set("company_type",companyType);if(hasCert)p.set("has_certification","true");p.set("limit","24");const data=await fetch(b+"/api/companies?"+p.toString()).then(r=>r.json());const results=data.results||[];const filterBits=[];if(companyType)filterBits.push(typeLabels[companyType]||companyType);if(state)filterBits.push(state);if(hasCert)filterBits.push("certified");document.getElementById("resultMeta").textContent=data.total+" result"+(data.total===1?"":"s")+(q?' for "'+q+'"':"")+(filterBits.length?" · "+filterBits.join(", "):"");const list=document.getElementById("resultList");list.innerHTML="";if(results.length===0){list.innerHTML='<div style="color:#4b564e;font-size:14px;padding:24px 0;">No matches yet — try a broader search, remove a filter, or browse by category.</div>';}results.forEach(co=>{const card=document.createElement("a");card.className="rcard";card.href="/companies/"+encodeURIComponent(co.slug);const loc=[co.location&&co.location.city,co.location&&co.location.state].filter(Boolean).join(", ");const statusBadgeCls=co.status==="founding"?"founding":(co.status==="claimed"?"verified":"draft");const statusBadge=co.status==="founding"?"Founding member":(co.status==="claimed"?"Verified":"Draft profile");const metaBits=[loc];if(co.companyType)metaBits.push(typeLabels[co.companyType]||co.companyType.replace(/_/g," "));if(co.foundedYear)metaBits.push("Est. "+co.foundedYear);card.innerHTML='<div class="rtop"><div><div class="rname">'+(co.name||"").replace(/</g,"&lt;")+'</div><div class="rloc">'+metaBits.filter(Boolean).join(" · ").replace(/</g,"&lt;")+'</div></div><span class="tbadge '+statusBadgeCls+'">'+statusBadge+'</span></div>'+(co.description?'<div class="rdesc">'+co.description.replace(/</g,"&lt;").slice(0,160)+'</div>':'');list.appendChild(card);});}catch(e){document.getElementById("resultMeta").textContent="Results are temporarily unavailable.";}})();<\/script>`;
  return shell({
    title: "Search — SpecGrid",
    description: "Search India's technical manufacturers by product, category, location, company type, and certification.",
    path: "/search",
    body,
    jsonLd: null
  });
}

async function companyPageHtml(slug, env) {
  const res = await apiFetch(env, `/api/companies/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  const co = await res.json();
  const loc = [co.location && co.location.city, co.location && co.location.state].filter(Boolean).join(", ");
  const statusLabel = co.status === "founding" ? "Founding member" : (co.status === "claimed" ? "Verified profile" : "Draft profile — compiled from public information");
  const statusBadgeCls = co.status === "founding" ? "founding" : (co.status === "claimed" ? "verified" : "draft");
  const certs = (co.certifications || []);
  const waNumber = (co.whatsappNumber || "").replace(/[^\d]/g, "");
  const waHref = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`Hi, I found you on SpecGrid and would like to enquire about your products.`)}` : null;

  let similar = [];
  if (co.category) {
    try {
      const simRes = await apiFetch(env, `/api/companies?category=${encodeURIComponent(co.category)}&limit=6`);
      const simData = await simRes.json();
      similar = (simData.results || []).filter(c => c.slug !== slug).slice(0, 3);
    } catch (e) {}
  }

  const isManuallyVerified = co.verificationTier === "manual_reviewed";
  const publicStatusLabel = co.status === "founding"
    ? "Founding member"
    : (co.status === "claimed" ? (isManuallyVerified ? "Verified" : "Claimed") : "Draft profile");
  const publicBadgeCls = co.status === "founding" ? "founding" : (co.status === "claimed" ? "verified" : "draft");
  const verifiedNote = co.status === "founding"
    ? `<p style="margin:6px 0 0;font-size:12.5px;color:var(--ink-soft);">"Founding member" means this company claimed early and was manually reviewed by SpecGrid (LinkedIn presence, company website, and GSTIN/CIN format checked) — see the <a href="/data-disclaimer">data disclaimer</a> for details.</p>`
    : (co.status === "claimed"
      ? (isManuallyVerified
        ? `<p style="margin:6px 0 0;font-size:12.5px;color:var(--ink-soft);">"Verified" means SpecGrid manually reviewed this company — checked its LinkedIn presence, its own website, and the format of its GSTIN/CIN. This is not a live government database check — see the <a href="/data-disclaimer">data disclaimer</a> for what "verified" does and doesn't mean.</p>`
        : `<p style="margin:6px 0 0;font-size:12.5px;color:var(--ink-soft);">"Claimed" means this company's work email matched their own listed website domain — it has not yet been manually reviewed. See the <a href="/data-disclaimer">data disclaimer</a> for details.</p>`)
      : "");
  const body = `<section class="psec"><a class="pback" href="/search">← Back to search</a>${co.status !== "founding" && co.status !== "claimed" ? `<div class="notice">This is a draft profile compiled from public information — not yet verified by the company. If this is your business, <a href="/claim/${slug}">claim and correct it</a> or read our <a href="/data-disclaimer">data disclaimer</a>.</div>` : ``}<div class="ptop"><div><h1 class="pname">${esc(co.name)}</h1><div class="ploc">${esc(loc)}${co.foundedYear ? " · Est. " + esc(co.foundedYear) : ""}${co.companyType ? " · " + esc(co.companyType.replace(/_/g, " ")) : ""}</div>${verifiedNote}</div><span class="tbadge ${publicBadgeCls}">${esc(publicStatusLabel)}</span></div>${co.description ? `<div class="psection"><h2>About</h2><p style="margin:0;font-size:14.5px;line-height:1.6;color:var(--ink-soft);">${esc(co.description)}</p></div>` : ``}${certs.length ? `<div class="psection"><h2>Certifications</h2><div class="certlist">${certs.map(c => `<div class="certitem"><span>${esc(c.name)}${c.issuingBody ? " — " + esc(c.issuingBody) : ""}</span>${c.verified ? '<span style="color:var(--green-deep);font-family:var(--mono);font-size:11px;">VERIFIED</span>' : ''}</div>`).join("")}</div></div>` : ``}<div class="psection"><h2>Enquire</h2><p style="margin:0 0 14px;font-size:14px;color:var(--ink-soft);">SpecGrid mediates all enquiries — your contact details go to the supplier only after you submit.</p><div style="display:flex;gap:10px;flex-wrap:wrap;"><a class="cta" href="/enquire/${esc(slug)}" style="display:inline-block;" onclick="try{window.__sg.track('enquiry_cta_click', ${JSON.stringify(slug)});}catch(e){}">Send an enquiry →</a>${waHref ? `<a href="${esc(waHref)}" style="display:inline-flex;align-items:center;gap:7px;background:#25D366;color:#fff;padding:9px 17px;border-radius:7px;font-size:13.5px;font-weight:600;text-decoration:none;"><svg viewBox="0 0 24 24" width="15" height="15" fill="#fff"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.28-1.38c1.45.79 3.08 1.21 4.76 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm0 18.15h-.01c-1.5 0-2.97-.4-4.24-1.16l-.3-.18-3.15.83.84-3.08-.2-.32a8.19 8.19 0 01-1.26-4.4c0-4.53 3.7-8.22 8.24-8.22 2.2 0 4.27.86 5.83 2.42a8.14 8.14 0 012.41 5.81c0 4.54-3.7 8.23-8.24 8.23z"/></svg>WhatsApp</a>` : ``}</div></div>${similar.length ? `<div class="psection"><h2>Similar suppliers</h2><div class="rlist">${similar.map(s => `<a class="rcard" href="/companies/${esc(s.slug)}"><div class="rtop"><div><div class="rname">${esc(s.name)}</div><div class="rloc">${esc([s.location && s.location.city, s.location && s.location.state].filter(Boolean).join(", "))}</div></div><span class="tbadge ${s.status === "founding" ? "founding" : (s.status === "claimed" ? "verified" : "draft")}">${s.status === "founding" ? "Founding member" : (s.status === "claimed" ? "Verified" : "Draft profile")}</span></div></a>`).join("")}</div></div>` : ``}</section>`;
  return shell({
    title: `${co.name} — SpecGrid`,
    description: co.description ? co.description.slice(0, 160) : `${co.name}, ${loc} — technical manufacturer profile on SpecGrid.`,
    path: `/companies/${slug}`,
    body,
    ogImage: co.logoUrl || undefined,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": co.name,
      "url": `${SITE_URL}/companies/${slug}`,
      "address": loc || undefined
    }
  });
}

// Real mediated enquiry form (Master Plan v14, Finding C). Replaces what was
// previously a mailto: link straight to the operator's inbox — that bypassed
// SpecGrid entirely and never touched the enquiries table, which directly
// contradicted the page copy's promise that "SpecGrid mediates all
// enquiries." This posts to the existing POST /api/enquiry endpoint (which
// already supported buyerName/buyerEmail/buyerPhone/message — it just had no
// real frontend form wired to it), and adds a subject line + optional
// "response requested by" date, matching ThomasNet's RFQ pattern at a scope
// that fits SpecGrid's mediated-enquiry model (no multi-supplier send, no
// file attachments yet — those need object storage, deliberately left out
// of this pass).
async function enquireFormHtml(slug, env) {
  const res = await apiFetch(env, `/api/companies/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  const co = await res.json();
  const body = `<section class="psec"><a class="pback" href="/companies/${esc(slug)}">← Back to ${esc(co.name)}</a><div class="claim-box enquiry-box"><h1>Send an enquiry to ${esc(co.name)}</h1><p class="sub">SpecGrid routes this to the supplier directly — your contact details are shared with them, not with anyone else.</p><form id="enqForm"><div class="fld"><label for="e_name">Your name</label><input id="e_name" required></div><div class="fld"><label for="e_company">Your company <span style="text-transform:none;font-weight:400;">(optional)</span></label><input id="e_company"></div><div class="fld"><label for="e_role">Your role <span style="text-transform:none;font-weight:400;">(optional)</span></label><input id="e_role" placeholder="e.g. Procurement manager"></div><div class="fld"><label for="e_email">Email</label><input id="e_email" type="email"></div><div class="fld"><label for="e_phone">Phone <span style="text-transform:none;font-weight:400;">(at least one of email/phone required)</span></label><input id="e_phone" type="tel"></div><div class="fld"><label for="e_subject">Subject</label><input id="e_subject" placeholder="e.g. 36kV VCB panel — 50 units, quote needed"></div><div class="fld"><label for="e_message">Details</label><textarea id="e_message" rows="4" required style="width:100%;padding:12px 14px;font-size:14.5px;border:1.5px solid var(--line);border-radius:8px;outline:none;background:#fff;font-family:inherit;" placeholder="What do you need, quantities, specs, timeline..."></textarea></div><div class="fld"><label for="e_industry">Your industry <span style="text-transform:none;font-weight:400;">(optional)</span></label><input id="e_industry" placeholder="e.g. EPC contractor, solar installer"></div><div class="fld"><label for="e_urgency">Timeline <span style="text-transform:none;font-weight:400;">(optional)</span></label><select id="e_urgency" style="width:100%;padding:12px 14px;font-size:14.5px;border:1.5px solid var(--line);border-radius:8px;background:#fff;"><option value="">Not sure yet</option><option value="immediate">Immediate — ready to order</option><option value="this_quarter">This quarter</option><option value="researching">Just researching options</option></select></div><div class="fld"><label for="e_by">Response requested by <span style="text-transform:none;font-weight:400;">(optional)</span></label><input id="e_by" type="date"></div><button class="claim-submit" type="submit">Send enquiry</button><div id="enqMsg" class="claim-msg"></div></form></div></section><script>document.getElementById("enqForm").addEventListener("submit",async function(e){e.preventDefault();const btn=e.target.querySelector("button");const msg=document.getElementById("enqMsg");const email=document.getElementById("e_email").value.trim();const phone=document.getElementById("e_phone").value.trim();if(!email&&!phone){msg.className="claim-msg err";msg.textContent="Please provide at least an email or a phone number.";return;}btn.disabled=true;btn.textContent="Sending…";msg.className="claim-msg";try{const r=await fetch("${API_BASE}/api/enquiry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companySlug:${JSON.stringify(slug)},buyerName:document.getElementById("e_name").value,buyerEmail:email||null,buyerPhone:phone||null,subject:document.getElementById("e_subject").value||null,message:document.getElementById("e_message").value,responseBy:document.getElementById("e_by").value||null,companyName:document.getElementById("e_company").value||null,role:document.getElementById("e_role").value||null,industry:document.getElementById("e_industry").value||null,urgency:document.getElementById("e_urgency").value||null})});const data=await r.json();if(!r.ok){msg.className="claim-msg err";msg.textContent=data.error||"Something went wrong — please try again.";btn.disabled=false;btn.textContent="Send enquiry";return;}msg.className="claim-msg ok";msg.textContent=data.message||"Enquiry sent.";e.target.querySelectorAll("input,textarea,button").forEach(el=>el.disabled=true);try{window.__sg.track("enquiry_submitted",${JSON.stringify(slug)});if(email)window.__sg.identify(email);}catch(e){}}catch(err){msg.className="claim-msg err";msg.textContent="Network error — please try again.";btn.disabled=false;btn.textContent="Send enquiry";}});<\/script>`;
  return shell({
    title: `Enquire — ${co.name} — SpecGrid`,
    description: `Send a mediated enquiry to ${co.name} on SpecGrid.`,
    path: `/enquire/${slug}`,
    body,
    jsonLd: null
  });
}

function forSuppliersHtml() {
  const faqs = [
    ["What if I'm already on IndiaMART?", "SpecGrid isn't a replacement for IndiaMART — it's a different kind of listing. Buyers here search by exact technical spec (voltage class, IP rating, certification), not by ad spend, and your enquiry goes straight to you without being resold to competitors."],
    ["Why pay if I'm already listed free?", "A draft profile is free and stays free — being found costs nothing. The founding member tier is for companies that want priority placement in their category and access to buyer-intent data (what buyers are searching for, before they enquire)."],
    ["Who can see my contact details?", "Never the public. Contact information is never shown on a public page — buyers submit an enquiry through SpecGrid, and it's routed to you directly. You choose how and whether to respond."],
    ["Can I remove my profile?", "Yes. Every draft profile was compiled from publicly available information (your own site, public directories). Claim it to edit or correct it, or email us and we'll remove it — no questions asked."],
    ["What if the data is wrong?", "Common with any directory built from public sources. Claim your profile to fix it directly, or email mathi@specgrid.in with the correction and we'll update it, usually within a day."]
  ];
  const body = `<section class="lp-hero"><div class="kicker">For manufacturers &amp; technical suppliers</div><h1>Your specs are invisible to the buyers who matter.</h1><p>Buyers searching for "36kV VCB, IEC type-tested, Coimbatore" don't find you on generic directories built for ad spend, not accuracy. SpecGrid indexes what you actually make.</p><a class="cta" href="mailto:mathi@specgrid.in?subject=${encodeURIComponent("Claim my SpecGrid profile")}" style="padding:13px 22px;font-size:14.5px;">Claim your profile →</a></section>

<section class="lp-sec"><h2>The problem with directories built for lead volume</h2><p class="lead">Most B2B directories in India optimize for one thing: selling your enquiry to as many people as possible, including your competitors.</p><div class="pain-grid"><div class="pain-card"><h3>Lead quality</h3><p>Generic enquiry forms don't tell you if the buyer actually needs what you make, or is a student project, or a reseller fishing for a quote to shop around.</p></div><div class="pain-card"><h3>Lead reselling</h3><p>The same enquiry is often sold to multiple listed suppliers at once — you're one of five quotes on a request that never mentioned you specifically.</p></div><div class="pain-card"><h3>No spec filtering</h3><p>Buyers can't filter by voltage class, IP rating, or certification — so you're competing on listing position and ad spend, not on what you can actually build.</p></div></div></section>

<section class="lp-sec"><h2>Your company is already listed</h2><p class="lead">We compile a first draft of every manufacturer's profile from public information — your own website, public catalogs, and industry listings — before ever reaching out. It's live now, whether you've claimed it or not.</p><div class="compare"><div class="comp-card bad"><h3>Draft (unclaimed)</h3><ul><li>"Unclaimed profile" badge shown to buyers</li><li>Specs limited to what's publicly listed</li><li>No control over description or details</li><li>Enquiries still route to you, but you can't verify the listing is accurate</li></ul></div><div class="comp-card good"><h3>Claimed &amp; verified</h3><ul><li>"Verified" badge — buyers trust it more</li><li>Full control: specs, certifications, description</li><li>No competitor links or ads anywhere on your page</li><li>WhatsApp / direct enquiry routing, your choice</li></ul></div></div></section>

<section class="lp-sec"><h2>Built for how buyers actually search now</h2><p class="lead">Increasingly, buyers ask ChatGPT or Perplexity before they search Google. Structured, specific profiles are what get cited back.</p><div class="mockup"><div class="q">"who makes 36kV vacuum circuit breakers in Coimbatore with ISO certification"</div><div class="a">Based on available directories, manufacturers include companies specializing in AIS and VCB panel systems tested to IEC standards in the Coimbatore–Salem industrial cluster...<br><span class="cite">cited: specgrid.in</span></div></div></section>

<section class="lp-sec"><h2>Know who's searching for what you make</h2><p class="lead">Founding members get visibility into buyer intent on SpecGrid — before an enquiry is even submitted.</p><div class="intel-card"><div class="stat" id="intelStat">…</div><div class="lbl" id="intelLabel">Loading real search activity…</div></div></section>
<script>(function(){fetch("${API_BASE}/api/public-stats").then(function(r){return r.json();}).then(function(d){var statEl=document.getElementById("intelStat"),lblEl=document.getElementById("intelLabel");if(!d.totalSearches){statEl.textContent="Early days";lblEl.textContent="SpecGrid is still building up search volume — founding members get this same live view, scoped to their own category, from day one.";return;}statEl.textContent=d.uniqueSearchers+" buyer"+(d.uniqueSearchers===1?"":"s");var lbl=d.totalSearches+" search"+(d.totalSearches===1?"":"es")+" on SpecGrid in the last "+d.days+" days";if(d.topQuery)lbl+=", most commonly for \\""+d.topQuery+"\\"";lbl+=" — a real, live number. Founding members see this broken down for their own category.";lblEl.textContent=lbl;}).catch(function(){document.getElementById("intelLabel").textContent="Live search data is temporarily unavailable.";});})();<\/script>

<section class="lp-sec"><h2>Founding member — first 25 companies</h2><div class="founding-box"><div><div class="n" id="foundingCount">25</div><div class="l" id="foundingLabel">founding spots available — priority placement in your category, locked in permanently for early members.</div></div><a class="cta" href="mailto:mathi@specgrid.in?subject=${encodeURIComponent("SpecGrid founding member — interested")}" style="white-space:nowrap;" onclick="try{window.__sg.track('founding_cta_click');}catch(e){}">Get founding pricing →</a></div></section>
<script>(function(){fetch("${API_BASE}/api/founding-count").then(function(r){return r.json();}).then(function(d){document.getElementById("foundingCount").textContent=d.remaining;document.getElementById("foundingLabel").textContent=(d.remaining===0?"founding spots — all claimed for now. ":"founding spots left of "+d.cap+" — ")+"priority placement in your category, locked in permanently for early members.";}).catch(function(){});})();<\/script>

<section class="lp-sec"><h2>Frequently asked</h2><div class="faq">${faqs.map(([q, a]) => `<details class="faq-item"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div></section>

<section class="lp-sec" style="text-align:center;border-top:1px solid var(--line-soft);"><h2 style="margin-bottom:6px;">Ready to see your profile?</h2><p class="lead" style="margin-left:auto;margin-right:auto;">Takes under a minute — reply with your company name or claim directly.</p><a class="cta" href="mailto:mathi@specgrid.in?subject=${encodeURIComponent("Claim my SpecGrid profile")}" style="padding:13px 22px;font-size:14.5px;">Claim your profile →</a><p style="margin-top:18px;font-size:12.5px;color:var(--ink-soft);"><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/data-disclaimer">Data Disclaimer</a></p></section>`;
  return shell({
    title: "For Suppliers — List Your Manufacturing Company on SpecGrid",
    description: "Claim your free SpecGrid profile. Buyers search by exact spec, not ad spend — no lead reselling, no competitor links, direct enquiry routing.",
    path: "/for-suppliers",
    body,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(([q, a]) => ({
        "@type": "Question",
        "name": q,
        "acceptedAnswer": { "@type": "Answer", "text": a }
      }))
    }
  });
}

function aboutHtml() {
  const body = `<section class="psec legal"><h1>About SpecGrid</h1><p>SpecGrid is a technical manufacturer directory for India, built to answer one question buyers keep struggling with: <em>who actually makes this, and to what spec?</em></p><h2>Why this exists</h2><p>Most B2B directories in India are optimized for ad spend and lead volume, not accuracy. A buyer looking for a specific voltage class or certification has to call five suppliers to find one who actually matches — and the suppliers who do match often can't be found at all, because they don't outspend everyone else on listings.</p><p>SpecGrid starts from the manufacturer's own public information — specs, certifications, what they actually build — and makes that searchable directly, without ad placement deciding who shows up first.</p><h2>Why Coimbatore</h2><p>SpecGrid started with the Elektrotec exhibitor community in Coimbatore — one of India's densest clusters of switchgear, transformer, and industrial electrical manufacturers. It's growing outward from there, one verified category at a time.</p><h2>Get in touch</h2><p>Questions, corrections, or interested in claiming your profile: <a href="mailto:mathi@specgrid.in">mathi@specgrid.in</a></p></section>`;
  return shell({
    title: "About — SpecGrid",
    description: "Why SpecGrid exists and who built it — India's technical manufacturer directory, built from Coimbatore.",
    path: "/about",
    body,
    jsonLd: null
  });
}

function termsHtml() {
  const body = `<section class="psec legal"><h1>Terms of Service</h1><div class="upd">Last updated: August 2026</div><p>These terms govern use of SpecGrid (specgrid.in). By using this site, you agree to them.</p><h2>What SpecGrid is</h2><p>SpecGrid is a directory of technical manufacturers, compiled in part from publicly available information and in part from information companies submit directly. It is not a marketplace, escrow service, or party to any transaction between a buyer and a supplier.</p><h2>Data sources and accuracy</h2><p>Draft profiles are compiled from public sources (company websites, public directories, industry listings) and have not been verified by the company they describe. Claimed profiles are controlled and updated by the company itself. SpecGrid does not guarantee the accuracy of any profile and is not liable for decisions made based on listed information.</p><h2>Your right to correct or remove your listing</h2><p>Any company can request correction or removal of its draft profile at any time by claiming it or by emailing mathi@specgrid.in. See the <a href="/data-disclaimer">Data Disclaimer</a> for details.</p><h2>Enquiries</h2><p>SpecGrid routes buyer enquiries to suppliers but is not responsible for the outcome of any resulting communication, quote, or transaction. Use judgment as you would with any other lead source.</p><h2>Intellectual property</h2><p>The SpecGrid name, design, and search/categorization schema belong to SpecGrid. Company-submitted content (descriptions, specs, certifications) remains the property of the submitting company.</p><h2>Limitation of liability</h2><p>SpecGrid is provided "as is." We are not liable for indirect, incidental, or consequential damages arising from use of the site, including reliance on directory data or enquiry outcomes.</p><h2>Changes</h2><p>These terms may be updated as the product evolves; material changes will be reflected here with an updated date.</p><h2>Contact</h2><p><a href="mailto:mathi@specgrid.in">mathi@specgrid.in</a></p></section>`;
  return shell({ title: "Terms of Service — SpecGrid", description: "Terms of Service for SpecGrid, India's technical manufacturer directory.", path: "/terms", body, jsonLd: null });
}

function privacyHtml() {
  const body = `<section class="psec legal"><h1>Privacy Policy</h1><div class="upd">Last updated: August 2026</div><h2>What we collect</h2><p>Directly from you: your email, name, and any details you submit through an enquiry, claim, or contact form. Automatically: basic device and usage data (via privacy-preserving Cloudflare Web Analytics — no cookies, no cross-site tracking today). If cookie-based analytics (PostHog, GA4) are added later, they will only fire after you consent via a cookie banner.</p><p>From public sources: for draft profiles, company information gathered from public websites and directories (see the <a href="/data-disclaimer">Data Disclaimer</a>).</p><h2>How we use it</h2><p>To route enquiries between buyers and suppliers, operate and improve the directory, and respond to correction or removal requests. We do not sell your data to third parties.</p><h2>Who we share it with</h2><p>Infrastructure providers only, to operate the service: Cloudflare (hosting, database, storage). We do not resell or share enquiry data with other suppliers or advertisers.</p><h2>Retention</h2><p>Enquiry and account data is kept as long as needed to operate the service, or until you request deletion.</p><h2>Your rights</h2><p>You can request access, correction, or deletion of your data, or of a company profile describing your business, by emailing <a href="mailto:mathi@specgrid.in">mathi@specgrid.in</a>.</p></section>`;
  return shell({ title: "Privacy Policy — SpecGrid", description: "Privacy Policy for SpecGrid, India's technical manufacturer directory.", path: "/privacy", body, jsonLd: null });
}

function dataDisclaimerHtml() {
  const body = `<section class="psec legal"><h1>Data Disclaimer</h1><div class="upd">Last updated: August 2026</div><p>Many profiles on SpecGrid start as <strong>draft profiles</strong>: compiled from information the company has already made public (its own website, public directories, industry listings), before the company has reviewed or confirmed it.</p><h2>What this means</h2><p>A draft profile is our best attempt at an accurate summary — it is not verified by the company and may contain errors, outdated information, or gaps. It is clearly labeled "Draft profile" wherever it appears.</p><h2>If you are the company</h2><p>You can: claim your profile to take control of it (edit specs, description, certifications directly), or request a correction or removal by emailing <a href="mailto:mathi@specgrid.in">mathi@specgrid.in</a> — no verification hurdle required to have inaccurate information removed.</p><h2>Once claimed</h2><p>A "Verified" badge means SpecGrid manually reviewed the company (checked its LinkedIn presence, its own website, and the format of its GSTIN/CIN) — this is not a live government database check, since no free public GST/MCA verification API exists today; it is a manual, judgment-based check by SpecGrid. A "Claimed" badge means only that the claimant's work email matched the company's own listed website domain — no manual review has happened yet. A "Founding member" badge is always manually reviewed. We will update this page if and when live government verification becomes part of the process.</p></section>`;
  return shell({ title: "Data Disclaimer — SpecGrid", description: "How SpecGrid compiles draft profiles, and how to claim, correct, or remove yours.", path: "/data-disclaimer", body, jsonLd: null });
}

const CLERK_PUBLISHABLE_KEY = "pk_test_YnVzeS1jcmlja2V0LTExMzMuY2xlcmsuYWNjb3VudHMuZGV2JA";
const CLERK_FRONTEND_API = "https://busy-cricket-1133.clerk.accounts.dev";

function accountHtml() {
  const body = `<section class="psec"><div id="clerkRoot" style="max-width:440px;margin:0 auto;"></div><div id="dashboard" style="display:none;max-width:640px;margin:0 auto;"></div><p id="clerkLoading" style="text-align:center;color:var(--ink-soft);font-size:14px;">Loading account…</p></section>
<script>
(function(){
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c];});}
  var s=document.createElement("script");
  s.setAttribute("data-clerk-publishable-key","${CLERK_PUBLISHABLE_KEY}");
  s.src="${CLERK_FRONTEND_API}/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
  s.async=true; s.crossOrigin="anonymous";
  s.addEventListener("load", async function(){
    try{
      await window.Clerk.load();
      document.getElementById("clerkLoading").style.display="none";
      render();
      window.Clerk.addListener(function(){ render(); });
    }catch(e){
      document.getElementById("clerkLoading").textContent="Could not load sign-in. Please refresh.";
    }
  });
  s.addEventListener("error", function(){ document.getElementById("clerkLoading").textContent="Could not load sign-in. Please refresh."; });
  document.head.appendChild(s);

  function render(){
    var root=document.getElementById("clerkRoot"), dash=document.getElementById("dashboard");
    if (window.Clerk.user){
      root.style.display="none"; root.innerHTML=""; dash.style.display="block";
      loadDashboard();
    } else {
      dash.style.display="none";
      root.style.display="block";
      window.Clerk.mountSignIn(root);
    }
  }

  async function loadDashboard(){
    var dash=document.getElementById("dashboard");
    var email = window.Clerk.user.primaryEmailAddress ? window.Clerk.user.primaryEmailAddress.emailAddress : "";
    try{window.__sg.track("account_view"); if(email) window.__sg.identify(email);}catch(e){}
    dash.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;"><div style="font-size:14px;color:var(--ink-soft);">Signed in as ' + esc(email) + '</div><div id="userBtn"></div></div><div id="dashBody">Loading your companies…</div>';
    window.Clerk.mountUserButton(document.getElementById("userBtn"));
    try{
      var token = await window.Clerk.session.getToken();
      var res = await fetch("${API_BASE}/api/my-enquiries", { headers: { Authorization: "Bearer " + token } });
      var data = await res.json();
      var el = document.getElementById("dashBody");
      if (!res.ok){ el.innerHTML = '<div class="claim-msg err">' + esc(data.error || "Something went wrong loading your account.") + '</div>'; return; }
      if (!data.companies || !data.companies.length){
        el.innerHTML = '<p style="color:var(--ink-soft);font-size:14px;line-height:1.6;">No claimed companies on this account yet. If you already claimed a profile, make sure you\\'re signed in with the same email you used to claim it — or <a href="/search">find your company</a> to claim it now.</p>';
        return;
      }
      var html = '<h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin:0 0 12px;">Your companies</h2><div class="rlist" style="margin-bottom:28px;">';
      data.companies.forEach(function(c){ html += '<a class="rcard" href="/account/edit/' + esc(c.slug) + '"><div class="rtop"><div class="rname">' + esc(c.name) + '</div><div class="rbadge">Edit profile →</div></div></a>'; });
      html += '</div><h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin:0 0 12px;">Recent enquiries</h2>';
      if (!data.results.length){
        html += '<p style="color:var(--ink-soft);font-size:14px;">No enquiries yet. When a buyer contacts you through SpecGrid, it\\'ll show up here.</p>';
      } else {
        html += '<div class="rlist">';
        data.results.forEach(function(e){
          html += '<div class="rcard"><div class="rtop"><div><div class="rname">' + esc(e.buyerName) + '</div><div class="rloc">' + esc(e.buyerEmail || e.buyerPhone || "") + '</div></div><div class="rbadge">' + esc(e.status) + '</div></div>' + (e.message ? '<div class="rdesc">' + esc(e.message) + '</div>' : '') + '</div>';
        });
        html += '</div>';
      }
      el.innerHTML = html;
    }catch(e){
      document.getElementById("dashBody").innerHTML = '<div class="claim-msg err">Could not load your data — please refresh.</div>';
    }
  }
})();
<\/script>`;
  return shell({
    title: "Account — SpecGrid",
    description: "Sign in to manage your claimed SpecGrid profile and view buyer enquiries.",
    path: "/account",
    body,
    jsonLd: null
  });
}

function adminHtml() {
  const body = `<section class="psec"><div id="clerkGate" style="text-align:center;color:var(--ink-soft);font-size:14px;">Checking your session…</div><div id="adminRoot" style="display:none;max-width:720px;"></div></section>
<script>
(function(){
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c];});}
  var s=document.createElement("script");
  s.setAttribute("data-clerk-publishable-key","${CLERK_PUBLISHABLE_KEY}");
  s.src="${CLERK_FRONTEND_API}/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
  s.async=true; s.crossOrigin="anonymous";
  s.addEventListener("load", async function(){
    try{
      await window.Clerk.load();
      if (!window.Clerk.user){
        document.getElementById("clerkGate").innerHTML = 'You need to be signed in. <a href="/account">Sign in →</a>';
        return;
      }
      document.getElementById("clerkGate").style.display="none";
      document.getElementById("adminRoot").style.display="block";
      try{var e=window.Clerk.user.primaryEmailAddress;if(e)window.__sg.identify(e.emailAddress);}catch(e){}
      loadAdmin();
    }catch(e){
      document.getElementById("clerkGate").textContent="Could not load your session. Please refresh.";
    }
  });
  s.addEventListener("error", function(){ document.getElementById("clerkGate").textContent="Could not load your session. Please refresh."; });
  document.head.appendChild(s);

  async function authedFetch(path, opts){
    var token = await window.Clerk.session.getToken();
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { Authorization: "Bearer " + token });
    return fetch("${API_BASE}" + path, opts);
  }

  async function loadAdmin(){
    var root=document.getElementById("adminRoot");
    root.innerHTML = '<h1 style="margin-bottom:20px;">Admin</h1><h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin:0 0 12px;">Analytics (last 30 days)</h2><div id="analyticsBody">Loading…</div><h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin:28px 0 12px;">Pending claims</h2><div id="claimsList">Loading…</div><h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin:28px 0 12px;">Unverified certifications</h2><div id="certsList">Loading…</div><h2 style="font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink-soft);margin:28px 0 12px;">Mark founding member</h2><div class="claim-box"><p class="sub">Once you\\'ve confirmed payment yourself (UPI, bank transfer, etc.), record it here — this flips the company to Founding member status on its public profile.</p><div id="foundingStatus" style="font-size:13px;color:var(--ink-soft);margin-bottom:14px;">Loading current count…</div><form id="foundingForm"><div class="fld"><label for="fm_slug">Company slug</label><input id="fm_slug" required placeholder="e.g. amptech-power-transformers"><div class="hint">The part after /companies/ in the profile URL.</div></div><div class="fld"><label for="fm_amount">Amount paid (optional)</label><input id="fm_amount" placeholder="e.g. ₹5000"></div><div class="fld"><label for="fm_ref">Payment reference (optional)</label><input id="fm_ref" placeholder="e.g. UPI txn ID"></div><div class="fld"><label for="fm_notes">Notes (optional)</label><input id="fm_notes"></div><button class="claim-submit" type="submit">Mark as founding member</button><div id="foundingMsg" class="claim-msg"></div></form></div>';
    refreshFoundingCount();
    loadAnalytics();
    document.getElementById("foundingForm").addEventListener("submit", async function(e){
      e.preventDefault();
      var btn = e.target.querySelector("button");
      var msg = document.getElementById("foundingMsg");
      btn.disabled = true; btn.textContent = "Saving…"; msg.className = "claim-msg";
      var slug = document.getElementById("fm_slug").value.trim();
      try{
        var r = await authedFetch("/api/admin/founding/" + encodeURIComponent(slug), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountPaid: document.getElementById("fm_amount").value || null, paymentReference: document.getElementById("fm_ref").value || null, notes: document.getElementById("fm_notes").value || null }) });
        var data = await r.json();
        if (!r.ok){ msg.className = "claim-msg err"; msg.textContent = data.error || "Something went wrong."; btn.disabled = false; btn.textContent = "Mark as founding member"; return; }
        msg.className = "claim-msg ok"; msg.textContent = esc(slug) + " is now a founding member.";
        btn.disabled = false; btn.textContent = "Mark as founding member";
        refreshFoundingCount();
      }catch(err){
        msg.className = "claim-msg err"; msg.textContent = "Network error — please try again.";
        btn.disabled = false; btn.textContent = "Mark as founding member";
      }
    });
    var claimsRes = await authedFetch("/api/admin/claims?status=pending");
    var claimsData = await claimsRes.json();
    var claimsEl = document.getElementById("claimsList");
    if (!claimsRes.ok){ claimsEl.innerHTML = '<div class="claim-msg err">' + esc(claimsData.error || "Could not load claims.") + '</div>'; }
    else if (!claimsData.results.length){ claimsEl.innerHTML = '<p style="color:var(--ink-soft);font-size:14px;">No pending claims.</p>'; }
    else {
      claimsEl.innerHTML = claimsData.results.map(function(c){
        var gstinLine = c.gstin ? ('GSTIN: ' + esc(c.gstin) + (c.gstinValidFormat ? ' (format OK)' : ' (format looks off)')) : 'GSTIN: not provided';
        var cinLine = c.cin ? ('CIN: ' + esc(c.cin) + (c.cinValidFormat ? ' (format OK)' : ' (format looks off)')) : 'CIN: not provided';
        return '<div class="rcard" style="margin-bottom:10px;" data-claim="' + esc(c.claimId) + '"><div class="rtop"><div><div class="rname">' + esc(c.companyName) + '</div><div class="rloc">' + esc(c.claimantName) + ' — ' + esc(c.claimantEmail) + '</div><div class="rloc">Company site: ' + esc(c.companyWebsite || "—") + '</div><div class="rloc">' + gstinLine + ' · ' + cinLine + '</div></div></div>' +
          '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:13px;">' +
          '<div style="font-weight:700;margin-bottom:8px;color:var(--ink-soft);">Manual review checklist</div>' +
          '<label style="display:flex;align-items:center;gap:7px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" class="chkLinkedin">Checked LinkedIn — company and this person\\'s profile look real</label>' +
          '<label style="display:flex;align-items:center;gap:7px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" class="chkPresence">Confirmed company has a real online presence (website, listings, etc.)</label>' +
          '<label style="display:flex;align-items:center;gap:7px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" class="chkGstin">GSTIN/CIN format checked above</label>' +
          '<label style="display:flex;align-items:center;gap:7px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" class="chkCalled">Called or messaged the claimant directly (optional fallback)</label>' +
          '<input type="text" class="chkNotes" placeholder="Notes (optional)" style="width:100%;padding:8px 10px;font-size:13px;border:1.5px solid var(--line);border-radius:6px;margin:6px 0 10px;">' +
          '<div style="display:flex;gap:8px;">' +
          '<button class="claim-submit verifyApproveBtn" style="width:auto;padding:8px 16px;margin:0;">Approve as Verified</button>' +
          '<button class="claim-submit rejectBtn" style="width:auto;padding:8px 16px;margin:0;background:#a3402a;">Reject</button>' +
          '</div></div></div>';
      }).join("");
      claimsEl.querySelectorAll(".verifyApproveBtn").forEach(function(btn){ btn.addEventListener("click", function(){ manuallyVerifyClaim(btn); }); });
      claimsEl.querySelectorAll(".rejectBtn").forEach(function(btn){ btn.addEventListener("click", function(){ actOnClaim(btn, "rejected"); }); });
    }

    var certsRes = await authedFetch("/api/admin/certifications");
    var certsData = await certsRes.json();
    var certsEl = document.getElementById("certsList");
    if (!certsRes.ok){ certsEl.innerHTML = '<div class="claim-msg err">' + esc(certsData.error || "Could not load certifications.") + '</div>'; }
    else if (!certsData.results.length){ certsEl.innerHTML = '<p style="color:var(--ink-soft);font-size:14px;">No unverified certifications.</p>'; }
    else {
      certsEl.innerHTML = certsData.results.map(function(c){
        return '<div class="rcard" style="margin-bottom:10px;" data-cert="' + esc(c.id) + '"><div class="rtop"><div><div class="rname">' + esc(c.name) + (c.issuingBody ? " — " + esc(c.issuingBody) : "") + '</div><div class="rloc">' + esc(c.companyName) + '</div></div><button class="claim-submit verifyBtn" style="width:auto;padding:8px 16px;margin:0;">Mark verified</button></div></div>';
      }).join("");
      certsEl.querySelectorAll(".verifyBtn").forEach(function(btn){ btn.addEventListener("click", function(){ verifyCert(btn); }); });
    }
  }

  async function actOnClaim(btn, status){
    var card = btn.closest("[data-claim]");
    var claimId = card.getAttribute("data-claim");
    card.querySelectorAll("button,input").forEach(function(b){ b.disabled = true; });
    btn.textContent = status === "approved" ? "Approving…" : "Rejecting…";
    try{
      var r = await authedFetch("/api/admin/claims/" + encodeURIComponent(claimId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: status }) });
      if (!r.ok){ var d = await r.json(); alert(d.error || "Something went wrong."); card.querySelectorAll("button,input").forEach(function(b){ b.disabled = false; }); btn.textContent = status === "approved" ? "Approve" : "Reject"; return; }
      card.style.opacity = "0.4";
      card.innerHTML = '<div style="padding:6px 0;color:var(--ink-soft);font-size:13.5px;">' + (status === "approved" ? "Approved." : "Rejected.") + '</div>';
    }catch(e){ card.querySelectorAll("button,input").forEach(function(b){ b.disabled = false; }); btn.textContent = status === "approved" ? "Approve" : "Reject"; }
  }

  async function manuallyVerifyClaim(btn){
    var card = btn.closest("[data-claim]");
    var claimId = card.getAttribute("data-claim");
    card.querySelectorAll("button,input").forEach(function(b){ b.disabled = true; });
    btn.textContent = "Approving…";
    var payload = {
      linkedinChecked: card.querySelector(".chkLinkedin").checked,
      companyPresenceChecked: card.querySelector(".chkPresence").checked,
      gstinFormatChecked: card.querySelector(".chkGstin").checked,
      calledOrMessaged: card.querySelector(".chkCalled").checked,
      notes: card.querySelector(".chkNotes").value || null
    };
    try{
      var r = await authedFetch("/api/admin/claims/" + encodeURIComponent(claimId) + "/verify", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok){ var d = await r.json(); alert(d.error || "Something went wrong."); card.querySelectorAll("button,input").forEach(function(b){ b.disabled = false; }); btn.textContent = "Approve as Verified"; return; }
      card.style.opacity = "0.4";
      card.innerHTML = '<div style="padding:6px 0;color:var(--ink-soft);font-size:13.5px;">Approved — marked Verified.</div>';
    }catch(e){ card.querySelectorAll("button,input").forEach(function(b){ b.disabled = false; }); btn.textContent = "Approve as Verified"; }
  }

  async function verifyCert(btn){
    var card = btn.closest("[data-cert]");
    var certId = card.getAttribute("data-cert");
    btn.disabled = true; btn.textContent = "Verifying…";
    try{
      var r = await authedFetch("/api/admin/certifications/" + encodeURIComponent(certId) + "/verify", { method: "PATCH" });
      if (!r.ok){ var d = await r.json(); alert(d.error || "Something went wrong."); btn.disabled = false; btn.textContent = "Mark verified"; return; }
      card.style.opacity = "0.4";
      card.innerHTML = '<div style="padding:6px 0;color:var(--ink-soft);font-size:13.5px;">Verified.</div>';
    }catch(e){ btn.disabled = false; btn.textContent = "Mark verified"; }
  }

  var EVENT_LABELS = { search: "Searches", company_view: "Profile views", enquiry_cta_click: "Enquiry clicks", enquiry_submitted: "Enquiries submitted", claim_submitted: "Claims submitted", founding_cta_click: "Founding CTA clicks", account_view: "Account views" };

  async function loadAnalytics(){
    var el = document.getElementById("analyticsBody");
    try{
      var r = await authedFetch("/api/admin/analytics?days=30");
      var d = await r.json();
      if (!r.ok){ el.innerHTML = '<div class="claim-msg err">' + esc(d.error || "Could not load analytics.") + '</div>'; return; }
      var html = '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;">';
      [["uniqueVisitors","Unique visitors"],["sessions","Sessions"],["identifiedVisitors","Identified (signed in)"]].forEach(function(pair){
        html += '<div style="background:#f4faf6;border:1px solid var(--green);border-radius:10px;padding:14px 18px;min-width:120px;"><div style="font-size:22px;font-weight:800;color:var(--green-deep);">' + (d[pair[0]] || 0) + '</div><div style="font-size:12px;color:var(--ink-soft);">' + esc(pair[1]) + '</div></div>';
      });
      html += '</div><div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:18px;">';
      Object.keys(EVENT_LABELS).forEach(function(key){
        var count = d.counts[key] || 0;
        html += '<div style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 18px;min-width:120px;"><div style="font-size:22px;font-weight:800;">' + count + '</div><div style="font-size:12px;color:var(--ink-soft);">' + esc(EVENT_LABELS[key]) + '</div></div>';
      });
      html += '</div>';
      if (d.topSources && d.topSources.length){
        html += '<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:6px;">Traffic sources</div><div class="rlist" style="margin-bottom:18px;">' + d.topSources.map(function(s){
          return '<div class="rcard"><div class="rtop"><div class="rname">' + esc(s.source) + '</div><div class="rbadge">' + s.count + ' sessions</div></div></div>';
        }).join("") + '</div>';
      }
      if (d.topLandingPages && d.topLandingPages.length){
        html += '<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:6px;">Top landing pages</div><div class="rlist" style="margin-bottom:18px;">' + d.topLandingPages.map(function(p){
          return '<div class="rcard"><div class="rtop"><div class="rname">' + esc(p.page) + '</div><div class="rbadge">' + p.count + '</div></div></div>';
        }).join("") + '</div>';
      }
      if (d.topCompanies && d.topCompanies.length){
        html += '<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:6px;">Most-viewed profiles</div><div class="rlist" style="margin-bottom:18px;">' + d.topCompanies.map(function(c){
          return '<a class="rcard" href="/companies/' + esc(c.slug) + '"><div class="rtop"><div class="rname">' + esc(c.slug) + '</div><div class="rbadge">' + c.views + ' views</div></div></a>';
        }).join("") + '</div>';
      }
      if (d.topQueries && d.topQueries.length){
        html += '<div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:6px;">Top search queries</div><div class="rlist">' + d.topQueries.map(function(q){
          return '<div class="rcard"><div class="rtop"><div class="rname">' + esc(q.query) + '</div><div class="rbadge">' + q.count + '×</div></div></div>';
        }).join("") + '</div>';
      }
      if (!d.topCompanies.length && !d.topQueries.length && Object.keys(d.counts).length === 0){
        html += '<p style="color:var(--ink-soft);font-size:14px;">No traffic recorded yet.</p>';
      }
      el.innerHTML = html;
    }catch(e){ el.innerHTML = '<div class="claim-msg err">Could not load analytics.</div>'; }
  }

  async function refreshFoundingCount(){
    var el = document.getElementById("foundingStatus");
    try{
      var r = await fetch("${API_BASE}/api/founding-count");
      var d = await r.json();
      el.textContent = d.claimed + " of " + d.cap + " founding spots used (" + d.remaining + " remaining).";
    }catch(e){ el.textContent = "Could not load founding count."; }
  }
})();
<\/script>`;
  return shell({
    title: "Admin — SpecGrid",
    description: "SpecGrid admin — review claims and certifications.",
    path: "/admin",
    body,
    jsonLd: null
  });
}

function editProfileHtml(slug) {
  const body = `<section class="psec"><a class="pback" href="/account">← Back to account</a><div id="clerkGate" style="text-align:center;color:var(--ink-soft);font-size:14px;">Checking your session…</div><div id="editRoot" style="display:none;max-width:560px;"></div></section>
<script>
(function(){
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}[c];});}
  var slug=${JSON.stringify(slug)};
  var s=document.createElement("script");
  s.setAttribute("data-clerk-publishable-key","${CLERK_PUBLISHABLE_KEY}");
  s.src="${CLERK_FRONTEND_API}/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
  s.async=true; s.crossOrigin="anonymous";
  s.addEventListener("load", async function(){
    try{
      await window.Clerk.load();
      if (!window.Clerk.user){
        document.getElementById("clerkGate").innerHTML = 'You need to be signed in to edit this profile. <a href="/account">Sign in →</a>';
        return;
      }
      document.getElementById("clerkGate").style.display="none";
      document.getElementById("editRoot").style.display="block";
      try{var e=window.Clerk.user.primaryEmailAddress;if(e)window.__sg.identify(e.emailAddress);}catch(e){}
      loadForm();
    }catch(e){
      document.getElementById("clerkGate").textContent="Could not load your session. Please refresh.";
    }
  });
  s.addEventListener("error", function(){ document.getElementById("clerkGate").textContent="Could not load your session. Please refresh."; });
  document.head.appendChild(s);

  async function authedFetch(path, opts){
    var token = await window.Clerk.session.getToken();
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { Authorization: "Bearer " + token });
    return fetch("${API_BASE}" + path, opts);
  }

  async function loadForm(){
    var root=document.getElementById("editRoot");
    root.innerHTML = '<p style="color:var(--ink-soft);font-size:14px;">Loading profile…</p>';
    var res, co;
    try{
      res = await authedFetch("/api/my-company/" + encodeURIComponent(slug));
      co = await res.json();
    }catch(e){
      root.innerHTML = '<div class="claim-msg err">Could not load your profile — please refresh.</div>';
      return;
    }
    if (!res.ok){
      root.innerHTML = '<div class="claim-msg err">' + esc(co.error || "Could not load your profile.") + '</div>';
      return;
    }
    root.innerHTML =
      '<div class="claim-box" style="margin-bottom:20px;"><h1>Edit ' + esc(co.name) + '</h1><p class="sub">Changes save directly to your public profile.</p>' +
      '<form id="editForm">' +
      '<div class="fld"><label for="f_description">Description</label><textarea id="f_description" rows="4" style="width:100%;padding:12px 14px;font-size:14.5px;border:1.5px solid var(--line);border-radius:8px;outline:none;background:#fff;font-family:inherit;">' + esc(co.description || "") + '</textarea></div>' +
      '<div class="fld"><label for="f_website">Website</label><input id="f_website" value="' + esc(co.website || "") + '"></div>' +
      '<div class="fld"><label for="f_city">City</label><input id="f_city" value="' + esc((co.location && co.location.city) || "") + '"></div>' +
      '<div class="fld"><label for="f_state">State</label><input id="f_state" value="' + esc((co.location && co.location.state) || "") + '"></div>' +
      '<div class="fld"><label for="f_founded">Founded year</label><input id="f_founded" value="' + esc(co.foundedYear || "") + '"></div>' +
      '<div class="fld"><label for="f_whatsapp">WhatsApp number</label><input id="f_whatsapp" value="' + esc(co.whatsappNumber || "") + '"><div class="hint">Include country code, digits only, e.g. 919876543210. Leave blank to hide the WhatsApp button.</div></div>' +
      '<button class="claim-submit" type="submit">Save changes</button>' +
      '<div id="editMsg" class="claim-msg"></div>' +
      '</form></div>' +
      '<div class="claim-box" id="intentBox" style="margin-bottom:20px;"><h1 style="font-size:18px;">Buyer intent — your category</h1><p id="intentBody" class="sub">Loading…</p></div>' +
      '<div class="claim-box"><h1 style="font-size:18px;">Certifications</h1>' +
      '<div id="certList"></div>' +
      '<form id="certForm" style="margin-top:14px;border-top:1px solid var(--line);padding-top:16px;">' +
      '<div class="fld"><label for="c_name">Certification name</label><input id="c_name" required placeholder="e.g. ISO 9001:2015"></div>' +
      '<div class="fld"><label for="c_body">Issuing body (optional)</label><input id="c_body" placeholder="e.g. BIS"></div>' +
      '<button class="claim-submit" type="submit">Add certification</button>' +
      '<div id="certMsg" class="claim-msg"></div>' +
      '</form></div>';

    renderCerts(co.certifications || []);
    loadBuyerIntent();

    document.getElementById("editForm").addEventListener("submit", async function(e){
      e.preventDefault();
      var btn = e.target.querySelector("button");
      var msg = document.getElementById("editMsg");
      btn.disabled = true; btn.textContent = "Saving…"; msg.className = "claim-msg";
      var payload = {
        description: document.getElementById("f_description").value,
        website: document.getElementById("f_website").value,
        locationCity: document.getElementById("f_city").value,
        locationState: document.getElementById("f_state").value,
        foundedYear: document.getElementById("f_founded").value,
        whatsappNumber: document.getElementById("f_whatsapp").value.replace(/[^\\d]/g, ""),
      };
      try{
        var r = await authedFetch("/api/my-company/" + encodeURIComponent(slug), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        var data = await r.json();
        if (!r.ok){ msg.className = "claim-msg err"; msg.textContent = data.error || "Something went wrong."; btn.disabled = false; btn.textContent = "Save changes"; return; }
        msg.className = "claim-msg ok"; msg.textContent = "Saved. Your public profile is updated.";
        btn.disabled = false; btn.textContent = "Save changes";
      }catch(err){
        msg.className = "claim-msg err"; msg.textContent = "Network error — please try again.";
        btn.disabled = false; btn.textContent = "Save changes";
      }
    });

    document.getElementById("certForm").addEventListener("submit", async function(e){
      e.preventDefault();
      var btn = e.target.querySelector("button");
      var msg = document.getElementById("certMsg");
      btn.disabled = true; btn.textContent = "Adding…"; msg.className = "claim-msg";
      try{
        var r = await authedFetch("/api/my-company/" + encodeURIComponent(slug) + "/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: document.getElementById("c_name").value, issuingBody: document.getElementById("c_body").value || null }) });
        var data = await r.json();
        if (!r.ok){ msg.className = "claim-msg err"; msg.textContent = data.error || "Something went wrong."; btn.disabled = false; btn.textContent = "Add certification"; return; }
        document.getElementById("c_name").value = ""; document.getElementById("c_body").value = "";
        msg.className = "claim-msg ok"; msg.textContent = "Added.";
        btn.disabled = false; btn.textContent = "Add certification";
        var fresh = await (await authedFetch("/api/my-company/" + encodeURIComponent(slug))).json();
        renderCerts(fresh.certifications || []);
      }catch(err){
        msg.className = "claim-msg err"; msg.textContent = "Network error — please try again.";
        btn.disabled = false; btn.textContent = "Add certification";
      }
    });
  }

  async function loadBuyerIntent(){
    var el = document.getElementById("intentBody");
    try{
      var r = await authedFetch("/api/my-company/" + encodeURIComponent(slug) + "/buyer-intent");
      var d = await r.json();
      if (!r.ok){ el.textContent = d.error || "Could not load buyer intent data."; return; }
      if (!d.hasEnoughData){
        el.textContent = "Not enough search activity yet on SpecGrid to show real numbers for your category — check back as traffic grows. This panel updates automatically.";
        return;
      }
      var html = '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:10px;">' +
        '<div><div style="font-size:22px;font-weight:800;">' + d.profileViews + '</div><div style="font-size:12px;color:var(--ink-soft);">Profile views, last ' + d.days + ' days</div></div>' +
        '<div><div style="font-size:22px;font-weight:800;">' + d.categorySearches + '</div><div style="font-size:12px;color:var(--ink-soft);">Searches in your category, last ' + d.days + ' days</div></div>' +
        '</div>';
      if (d.topQueriesInCategory && d.topQueriesInCategory.length){
        html += '<div style="font-size:12.5px;color:var(--ink-soft);">Top search terms in your category: ' +
          d.topQueriesInCategory.map(function(q){ return esc(q.query) + ' (' + q.count + ')'; }).join(", ") + '</div>';
      }
      el.innerHTML = html;
    }catch(e){
      el.textContent = "Could not load buyer intent data — please refresh.";
    }
  }

  function renderCerts(certs){
    var el = document.getElementById("certList");
    if (!certs.length){ el.innerHTML = '<p style="color:var(--ink-soft);font-size:14px;">No certifications listed yet.</p>'; return; }
    el.innerHTML = '<div class="certlist">' + certs.map(function(c){
      return '<div class="certitem"><span>' + esc(c.name) + (c.issuingBody ? " — " + esc(c.issuingBody) : "") + (c.verified ? ' <span style="color:var(--green-deep);font-family:var(--mono);font-size:11px;">VERIFIED</span>' : '') + '</span><button data-id="' + esc(c.id) + '" class="certDel" style="background:none;border:none;color:#a3402a;cursor:pointer;font-size:12.5px;">Remove</button></div>';
    }).join("") + '</div>';
    el.querySelectorAll(".certDel").forEach(function(btn){
      btn.addEventListener("click", async function(){
        btn.disabled = true; btn.textContent = "Removing…";
        try{
          await authedFetch("/api/my-company/" + encodeURIComponent(slug) + "/certifications/" + encodeURIComponent(btn.getAttribute("data-id")), { method: "DELETE" });
          var fresh = await (await authedFetch("/api/my-company/" + encodeURIComponent(slug))).json();
          renderCerts(fresh.certifications || []);
        }catch(e){ btn.disabled = false; btn.textContent = "Remove"; }
      });
    });
  }
})();
<\/script>`;
  return shell({
    title: `Edit profile — SpecGrid`,
    description: "Edit your claimed SpecGrid company profile.",
    path: `/account/edit/${slug}`,
    body,
    jsonLd: null
  });
}

async function claimHtml(slug, env) {
  const res = await apiFetch(env, `/api/companies/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  const co = await res.json();
  const already = co.status === "claimed" || co.status === "founding";
  const body = `<section class="psec"><a class="pback" href="/companies/${esc(slug)}">← Back to ${esc(co.name)}</a><div class="claim-box"><h1>Claim ${esc(co.name)}</h1><p class="sub">${already ? "This profile has already been claimed." : "Confirm it's your company and take control of the profile — edit specs, add certifications, and remove the draft badge."}</p>${already ? `<p style="font-size:14px;color:var(--ink-soft);">If this was a mistake, or you believe this claim was made in error, email <a href="mailto:mathi@specgrid.in">mathi@specgrid.in</a>.</p>` : `<form id="claimForm"><div class="fld"><label for="cname">Your name</label><input id="cname" required></div><div class="fld"><label for="cemail">Work email</label><input id="cemail" type="email" required><div class="hint">Use your company email address — if the domain matches ${co.website ? esc(co.website.replace(/^https?:\/\//, "").replace(/\/$/, "")) : "your company's listed website"}, your claim is approved instantly. Otherwise we review it by hand, usually within a day.</div></div><div class="fld"><label for="cgstin">GSTIN <span style="text-transform:none;font-weight:400;">(optional)</span></label><input id="cgstin" placeholder="e.g. 33AAAAA0000A1Z5" maxlength="15"><div class="hint">Format-checked only — we don't call the government GST database. Helps us process manual review faster.</div></div><div class="fld"><label for="ccin">CIN <span style="text-transform:none;font-weight:400;">(optional)</span></label><input id="ccin" placeholder="e.g. U12345TN2020PTC123456" maxlength="21"></div><button class="claim-submit" type="submit">Submit claim</button><div id="claimMsg" class="claim-msg"></div></form><script>document.getElementById("claimForm").addEventListener("submit",async function(e){e.preventDefault();const btn=e.target.querySelector("button");const msg=document.getElementById("claimMsg");btn.disabled=true;btn.textContent="Submitting…";msg.className="claim-msg";try{const r=await fetch("${API_BASE}/api/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companySlug:"${slug}",name:document.getElementById("cname").value,workEmail:document.getElementById("cemail").value,gstin:document.getElementById("cgstin").value||null,cin:document.getElementById("ccin").value||null})});const data=await r.json();if(!r.ok){msg.className="claim-msg err";msg.textContent=data.error||"Something went wrong — please try again or email mathi@specgrid.in.";btn.disabled=false;btn.textContent="Submit claim";return;}msg.className="claim-msg ok";msg.textContent=data.message+(data.claimId?" Claim ID: "+data.claimId:"");e.target.querySelector('input,button').closest("form").querySelectorAll("input,button").forEach(el=>el.disabled=true);try{window.__sg.track("claim_submitted","${slug}",{status:data.status});window.__sg.identify(document.getElementById("cemail").value);}catch(e){}}catch(err){msg.className="claim-msg err";msg.textContent="Network error — please try again or email mathi@specgrid.in.";btn.disabled=false;btn.textContent="Submit claim";}});<\/script>`}</div></section>`;
  return shell({
    title: `Claim ${co.name} — SpecGrid`,
    description: `Claim and verify the SpecGrid profile for ${co.name}.`,
    path: `/claim/${slug}`,
    body,
    jsonLd: null
  });
}

function notFoundHtml() {
  return shell({
    title: "Not found — SpecGrid",
    description: "This page could not be found.",
    path: "/404",
    body: `<section class="psec"><h1 class="pname">Page not found</h1><p style="color:var(--ink-soft);">The page you're looking for doesn't exist. <a href="/">Go back home</a> or <a href="/search">search the directory</a>.</p></section>`,
    jsonLd: null
  });
}

function robotsTxt() {
  return `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

async function sitemapXml(env) {
  let urls = [`${SITE_URL}/`, `${SITE_URL}/search`, `${SITE_URL}/for-suppliers`, `${SITE_URL}/about`, `${SITE_URL}/terms`, `${SITE_URL}/privacy`, `${SITE_URL}/data-disclaimer`];
  try {
    const data = await apiFetch(env, `/api/companies?limit=250`).then(r => r.json());
    (data.results || []).forEach(co => urls.push(`${SITE_URL}/companies/${co.slug}`));
  } catch (e) {}
  const body = urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let { pathname } = url;
    if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
    if (pathname.startsWith("/companies/") && pathname.endsWith(".html")) {
      pathname = pathname.slice(0, -5);
    }

    if (pathname === "" || pathname === "/") {
      return new Response(homepageHtml(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    if (pathname === "/search") {
      trackAsync(env, ctx, "search", null, { q: url.searchParams.get("q") || null, category: url.searchParams.get("category") || null, state: url.searchParams.get("state") || null, companyType: url.searchParams.get("company_type") || null, hasCertification: url.searchParams.get("has_certification") || null }, request);
      return new Response(searchPageHtml(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    if (pathname === "/og-default.png") {
      const bytes = Uint8Array.from(atob(OG_IMAGE_B64), c => c.charCodeAt(0));
      return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
    }
    if (pathname === "/account") {
      return new Response(accountHtml(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    if (pathname === "/admin") {
      return new Response(adminHtml(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    const em = pathname.match(/^\/account\/edit\/([a-z0-9-]+)$/);
    if (em) {
      return new Response(editProfileHtml(em[1]), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    if (pathname === "/for-suppliers") {
      return new Response(forSuppliersHtml(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    if (pathname === "/about") {
      return new Response(aboutHtml(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    if (pathname === "/terms") {
      return new Response(termsHtml(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    if (pathname === "/privacy") {
      return new Response(privacyHtml(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    if (pathname === "/data-disclaimer") {
      return new Response(dataDisclaimerHtml(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    if (pathname === "/robots.txt") {
      return new Response(robotsTxt(), { headers: { "Content-Type": "text/plain;charset=UTF-8" } });
    }
    if (pathname === "/sitemap.xml") {
      return new Response(await sitemapXml(env), { headers: { "Content-Type": "application/xml;charset=UTF-8" } });
    }
    const m = pathname.match(/^\/companies\/([a-z0-9-]+)$/);
    if (m) {
      const html = await companyPageHtml(m[1], env);
      if (html) {
        trackAsync(env, ctx, "company_view", m[1], null, request);
        return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
      }
      return new Response(notFoundHtml(), { status: 404, headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    const cm = pathname.match(/^\/claim\/([a-z0-9-]+)$/);
    if (cm) {
      const html = await claimHtml(cm[1], env);
      if (html) return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
      return new Response(notFoundHtml(), { status: 404, headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    const eqm = pathname.match(/^\/enquire\/([a-z0-9-]+)$/);
    if (eqm) {
      const html = await enquireFormHtml(eqm[1], env);
      if (html) return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
      return new Response(notFoundHtml(), { status: 404, headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
    return new Response(notFoundHtml(), { status: 404, headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
