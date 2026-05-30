/**
 * Massive API proxy — Cloudflare Worker (gratis tier)
 * ---------------------------------------------------
 * Doel: de browser-app (statisch, GitHub Pages) kan Massive niet veilig direct
 * aanroepen (CORS + de betaalde API-key zou in de browser lekken). Deze Worker
 * staat ertussen: hij houdt de key server-side geheim, voegt CORS toe, en stuurt
 * elk pad 1-op-1 door naar de Massive REST-API.
 *
 * DEPLOY (zonder CLI, via dashboard):
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker → plak deze code → Deploy
 *   2. Settings → Variables and Secrets:
 *        MASSIVE_API_KEY  (type: Secret)   = jouw Massive API key
 *        MASSIVE_BASE     (type: Text)     = https://api.massive.com   (controleer in je Massive quickstart)
 *        ALLOW_ORIGIN     (type: Text)     = https://frankherling95-sketch.github.io
 *   3. Kopieer de Worker-URL (bv. https://massive-proxy.<jij>.workers.dev)
 *      en plak die in de app → Instellingen → Marktdata → "Massive proxy-URL".
 *
 * GEBRUIK vanuit de app: roep aan als  <WORKER_URL>/<massive-pad-en-query>
 *   bv.  https://massive-proxy.<jij>.workers.dev/v3/snapshot?ticker.any_of=AAPL,X:BTCUSD
 *   De Worker plakt de key erbij en forwardt naar  <MASSIVE_BASE>/v3/snapshot?...
 *
 * Veiligheid: zet ALLOW_ORIGIN op je eigen Pages-URL (niet '*') zodat alleen jouw
 * app de proxy mag gebruiken. De key staat als Secret in Cloudflare, nooit in de app.
 */
export default {
  async fetch(request, env) {
    const ALLOW_ORIGIN = env.ALLOW_ORIGIN || '*';
    const BASE = (env.MASSIVE_BASE || 'https://api.massive.com').replace(/\/$/, '');
    const cors = {
      'Access-Control-Allow-Origin': ALLOW_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });
    if (!env.MASSIVE_API_KEY) return json({ error: 'MASSIVE_API_KEY ontbreekt in Worker-config' }, 500, cors);

    const inUrl = new URL(request.url);
    // Pad + query 1-op-1 doorsturen. (Negeer favicon e.d.)
    if (inUrl.pathname === '/' || inUrl.pathname === '/favicon.ico') {
      return json({ ok: true, hint: 'Gebruik <worker>/v3/snapshot?ticker.any_of=AAPL' }, 200, cors);
    }
    const target = new URL(BASE + inUrl.pathname + inUrl.search);
    target.searchParams.set('apiKey', env.MASSIVE_API_KEY); // auth server-side toevoegen

    // korte edge-cache om rate-limits + snelheid te helpen
    const cacheKey = new Request(target.toString(), { method: 'GET' });
    const cache = caches.default;
    let resp = await cache.match(cacheKey);
    if (!resp) {
      const upstream = await fetch(target.toString(), { headers: { Accept: 'application/json' } });
      const body = await upstream.text();
      resp = new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
          'Cache-Control': 'public, max-age=60',
        },
      });
      if (upstream.ok) await cache.put(cacheKey, resp.clone());
    }
    // CORS-headers toevoegen op de (mogelijk gecachte) response
    const out = new Response(resp.body, resp);
    Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
    return out;
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
