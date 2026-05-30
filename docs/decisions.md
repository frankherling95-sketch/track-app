# Decisions log

Append-only ADR-stijl log. Oude entries nooit wijzigen.

## 2026-05-25 · Project bootstrap

**Beslissing**: Dividend tracker opgezet als single-file HTML SPA, zelfde opzet als Productivity App.

**Waarom**: Frank wilde "dezelfde opzet als productivity app". Geen build step, vanilla JS, makkelijk te hosten op GitHub Pages. Cross-app sync apart (eigen Gist) zodat de twee apps onafhankelijk blijven evolueren.

**Bestanden**: `index.html` (alles inline), `validate.mjs`, `manifest.json`, `sw.js`, `dividend-icon.svg`.

**Niet doen**: geen React/Vue/build pipeline introduceren — dat breekt de "open in browser, klaar" workflow.

## 2026-05-25 · Geen externe API in MVP

**Beslissing**: Geen Yahoo Finance / Alpha Vantage / FMP koppeling in eerste versie. Koersen en dividend-per-aandeel worden handmatig in de ticker-stamdata gezet.

**Waarom**: API-keys, rate limits en CORS-issues vertragen de eerste werkbare versie. Frank gaf aan dat CSV-import voor de eerste versie volstaat. Stamdata-velden zijn al aanwezig zodat een API-laag later non-breaking toegevoegd kan worden.

**Niet doen**: ticker-velden hernoemen zonder migratie — bestaande data zou breken.

## 2026-05-25 · Eigen Gist, los van Productivity App

**Beslissing**: Aparte storage keys (`herling_dividend_*`) en eigen Gist-file (`herling_dividend_tracker.json`). Geen gedeelde Gist met productivity app.

**Waarom**: Apps blijven onafhankelijk versionable. Token-rotatie/permission management is per-app. Frank kan één Gist verwijderen zonder de andere te raken.

## 2026-05-25 · Stock Intel (React+Vite) vervangen

**Beslissing**: De bestaande `Finance App/` (Stock Intel, React+Vite prototype voor fundamentele analyse) is gearchiveerd naar `../_archive/stock-intel-backup-2026-05-25/` en vervangen door deze dividend tracker.

**Waarom**: Twee finance-apps naast elkaar onderhouden was duplicatie. Frank koos deze dividend tracker als de actieve. De Stock Intel-bron is bewaard zodat ideeën uit Analysis/Earnings/Technical-tabs later eventueel hier toegevoegd kunnen worden (fundamentele analyse als nieuwe module).

**Bestanden**: Verplaatst van `Dividend Tracker/` naar `Finance App/`. Geen git-historie verloren (origineel was niet onder git).

## 2026-05-25 · FX-conversie via "laatste-gebruikte koers" (bug fix)

**Probleem**: Eerste versie telde `ticker.price` en `ticker.dps` in native currency (USD/EUR) zonder conversie op bij EUR-bedragen. Dashboard, posities en projectie toonden te hoge bedragen (€13.930 ipv €13.101 voor de test-portfolio).

**Beslissing**: `fxForCurrency(currency)` helper toegevoegd die de meest recente `fx`-koers uit transacties/dividenden van die valuta opzoekt. Gebruikt in `portfolioStats()`, `renderHoldings()`, en `renderPieChart()`. Geen aparte API of FX-tabel.

**Waarom**: Pragmatisch en self-contained. Zolang de user FX invult op zijn transacties (wat hij toch al doet voor de EUR-totaal-berekening), is er een koers beschikbaar voor ticker-stamdata-bedragen. Een echte FX-API kan later non-breaking erbij.

**Niet doen**: ticker.price/dps stiekem in EUR opslaan — dan kloppen ze niet meer met wat de broker rapporteert. Native currency blijft.

## 2026-05-25 · Tabel horizontaal scrollen op smal viewport

**Probleem**: Op viewports < 900px werden brede tabellen (Tickers, Posities) afgekapt zonder scroll.

**Beslissing**: `.tbl-wrap { overflow-x: auto }` + `.tbl { min-width: 560px }`. Native horizontale scrollbar verschijnt automatisch wanneer nodig.

**Waarom**: Simpeler dan responsive kolom-hiding. Gebruiker ziet altijd alle data, kan scrollen op mobiel. Native scroll-behavior is consistent met platform.

## 2026-05-30 · Massive API als toekomstige primaire databron (via Worker)

**Beslissing**: Massive (massive.com, Polygon-achtige API) wordt de beoogde primaire
marktdata-bron, MAAR alleen via een gratis Cloudflare Worker proxy — niet direct vanuit
de browser.

**Waarom**: Massive dekt alles in één bron (koersen, OHLC-historie, dividends, ticker-
overview met sector/industrie, echte + historische FX, crypto, evt. corporate-events).
Betrouwbaarder dan de huidige Yahoo-CORS-proxy. Maar het is een server-side API met een
betaalde key → de statische GitHub-Pages-app mag/kan 'm niet direct aanroepen (CORS +
key-lek). Een gratis Worker houdt de key geheim, lost CORS op, en `Unified Snapshot`
laat álle posities in 1 call verversen (binnen gratis rate-limits).

**Architectuur**: App → gratis Cloudflare Worker (`massive-proxy-worker.js`) → Massive.
Additief: Massive wordt primair zodra een Worker-URL is ingesteld; anders blijft de app
op Yahoo/CoinGecko draaien (geen regressie).

**Open**: gebruikers-tier bij Massive onbekend (partner-endpoints zoals TMX corporate-
events/Benzinga zijn vermoedelijk betaald). Exacte endpoint-paden verifiëren via de
mcp_massive connector vóór de app-integratie. US-data in USD → EUR via Massive-FX.

**Niet doen**: betaalde key direct in de browser of via publieke CORS-proxy zetten (lek).

## 2026-05-30 · Massive geïntegreerd — gratis-tier geverifieerd + gebouwd

**Context**: Worker live op `massiveproxy.frankherling95.workers.dev` (key als Secret).
Endpoints getest via de Worker om zeker te zijn dat verversen niet achteraf faalt.

**Geverifieerd op gratis tier (status OK)**:
- Koersen: `GET /v2/aggs/ticker/{sym}/prev` (slotkoers, EOD).
- **Bulk: `GET /v2/aggs/grouped/locale/us/market/stocks/{date}`** → álle ~12.288
  US-aandelen in **één** call. Kern van de oplossing.
- Forex: `GET /v2/aggs/ticker/C:{CUR}EUR/prev` (EUR per 1 unit).
- Crypto: `GET /v2/aggs/ticker/X:BTCUSD/prev` (USD).
- Ticker-overview: `GET /v3/reference/tickers/{sym}` (naam, market_cap, sic_description→sector).
- Dividenden: `GET /stocks/v1/dividends?ticker={sym}` (ex-datum, cash_amount, frequency).

**Betaald (NIET gebruiken)**: `GET /v3/snapshot` (realtime) → `NOT_AUTHORIZED`.

**Rate-limit BEVESTIGD**: ~5 calls/min. 14 calls in 2s → `HTTP 429`. Daarom géén
per-ticker koers-calls maar **1 grouped-call** voor alle US-aandelen, in-memory +
localStorage gecached (10 min), plus 60s edge-cache in de Worker.

**Gebouwd in index.html**:
- `massiveBase()` (leest `LS_MASSIVE_URL`), `massiveFetch()`, `getMassiveGroupedMap()`
  (1 grouped-call → `Map(sym→USD)`, cache `LS_MV_GROUPED` 10 min), `massiveStockPriceUSD()`,
  `fetchMassiveFx()`, `fetchMassiveOverview()`.
- `refreshTicker()` stocks: Massive-prijs primair (alleen als Yahoo USD bevestigt óf valuta
  onbekend is → voorkomt symbool-collisie met EU-ticker); Massive overview vult sector/
  marktkap/naam als leeg. Yahoo blijft bron voor dps/ex-div/freq én fallback.
- `fetchAndCacheFx()`: Massive-forex primair, Yahoo fallback. Crypto blijft CoinGecko.
- **Fallback-garantie**: élke Massive-fout (429/NOT_AUTHORIZED/netwerk) wordt stil gevangen →
  app valt terug op Yahoo/CoinGecko. Verversen eindigt dus nooit met een foutmelding.
- Instellingen → Marktdata: veld "Massive proxy-URL" + "Testen"-knop.
- Gratis tier = EOD → koersen zijn slotkoersen (geen realtime; prima voor lange-termijn).

**Caveat**: grouped is US-only → EU-tickers (.AS/.DE) komen via Yahoo-fallback.

**Notitie validate.mjs**: bestaande checker is in orde; draai 'm vanuit de `Finance App/`-map
(`node validate.mjs` leest `index.html` relatief t.o.v. cwd).
