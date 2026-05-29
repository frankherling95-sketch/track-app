# ARCHITECTURE

> Mappenstructuur, conventies, state-management, patterns. Raadpleeg vóór elke codewijziging.

## Mappenstructuur
```
Finance App/
├── index.html              ← DE APP (alles: HTML + <style> + <script>, ~6000 regels)
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service Worker (stale-while-revalidate, app-shell cache)
├── dividend-icon.svg       ← logo/favicon
├── validate.mjs            ← syntax/tag-balance checker (Node, pre-push)
├── README.md               ← korte gebruikersuitleg
├── CLAUDE.md               ← projectinstructies voor AI
├── .githooks/pre-push      ← draait validate.mjs + blokkeert force-push
├── .github/workflows/pages.yml ← validate + deploy naar GitHub Pages
└── docs/
    ├── SYSTEM_CONTEXT.md   ← wat & waarom
    ├── ARCHITECTURE.md     ← dit bestand
    ├── DATAMODEL.md        ← datastructuren
    └── decisions.md        ← ADR-log (append-only, waarom-beslissingen)
```
**Alle code-wijzigingen gebeuren in `index.html`.** Er zijn geen losse modules; "modulariteit" = functies + duidelijke secties met `/* ═══ KOPJE ═══ */` banners.

## Layout van index.html (volgorde)
1. `<head>` — meta, fonts (Archivo/Inter/JetBrains Mono via Google Fonts), manifest
2. `<style>` — CSS-tokens → base → componenten → modules → media-queries
3. `<body>` — top-nav, `#content`, bottom-tab, alle modals/sheets, `<script>`
4. `<script>` — state → utils → compute → fetch → render → routing → boot

## State-management
Eén globale mutable `rawState` (zie `DATAMODEL.md` voor vorm). Geen reactive system — **na elke mutatie zelf `scheduleSave()` + `renderAll()` aanroepen**.

### Save-flow (kritisch patroon)
```js
muteer rawState
scheduleSave()   // → localStorage direct (vangnet) → 1500ms debounce → saveGist()
renderAll()      // herrendert huidige route
```
- `scheduleSave()` schrijft **altijd** direct naar `localStorage[LS_BACKUP_KEY]` (geen dataverlies), debounced de Gist-PATCH.
- `saveGist()` = `PATCH /gists/:id` zonder conflict-check (single-user). Bij netwerkfout: 5s retry.
- `loadGist()` bij boot na localStorage; overschrijft state als Gist nieuwer/aanwezig.
- `initState()` migreert/hydrateert ontbrekende velden (voeg hier nieuwe state-velden toe met default).

### In-memory caches (niet persistent, behalve waar genoemd)
| Cache | Type | Doel |
|-------|------|------|
| `_priceHistCache` | Map | historische koersreeksen per ticker (sessie) |
| `_wlHistoryCache` | Map | watchlist-historie per ticker (sessie) |
| `_perfBenchData` | Map | benchmark-reeksen tijdens render |
| `localStorage[LS_BENCH_PREFIX+sym]` | persistent (4u TTL) | Yahoo koershistorie |
| `localStorage[LS_FX_CACHE]` | persistent | FX-rates naar EUR |

## Routing-patroon
- `ROUTES` object: `{ key: { title, render, actions } }`. `render` vult `#content`, `actions` levert HTML voor de knop(pen) rechts in de page-head.
- `ROUTE_ALIASES` mapt oude hashes (`dashboard`→`portfolio`, `transactions`→`actions`, `dividends`→`dividend`).
- `navigate(route)` zet `location.hash`; `hashchange` → `renderAll()`.
- `renderAll()`: highlight nav, zet titel/sub/actions, roept `def.render()`, daarna `renderPortfolioSelect()` + `updateValuePill()` + `updateTtButton()`.
- Async renders (dividend, watchlist) tonen eerst een "laden…" placeholder en vullen daarna via een aparte `async function ...Rows()`.

## Render-patroon (belangrijk)
- Render-functies bouwen een **template-string** en zetten die als `innerHTML`. Geen virtual DOM, geen element-refs bewaren.
- Event-handlers zijn **inline `onclick="fn(...)"`** met globale functies (daarom staan handlers op `window`-scope). `escapeHtml()` op alle user-content.
- Herhaalde sub-renders (bv. donut bij tab-wissel) hebben eigen functie die alleen dat deel herrendert (bv. `renderPortBreakdownDonutAndLegend()`).

## Responsive patroon (mobile-first cards)
Brede tabellen → op mobiel **cards** i.p.v. horizontale scroll. Patroon:
- Render zowel `.xxx-table-wrap` (desktop) als `.xxx-cards` (mobiel) uit **één keer berekende** data-array.
- CSS: `.xxx-cards { display:none }` → `@media (max-width:768px) { .xxx-table-wrap{display:none} .xxx-cards{display:block} }`.
- Accordion-uitklap via `grid-template-rows: 0fr → 1fr` transition (geen JS-hoogte).
- Toegepast op: **watchlist** (`.wl-cards`/`.wl-card`) en **effecten** (`.sec-cards`/`.sec-card`).
- Globaal vangnet: `html,body,.app { overflow-x:hidden; max-width:100% }`.

## CSS-conventies
- **Design-tokens** in `:root` (+ `[data-theme="dark"]` + `prefers-color-scheme`): `--navy #0F1B3D`, `--teal`, `--mint #00E5B0`, `--bg/--surface/--surface2/--surface3`, `--text/--text-muted/--text-hint`, `--border/--border-strong`, `--success/--danger/--gold/--sky`, `--radius`, `--shadow*`, `--font-display/sans/mono`.
- **Class-prefixes per module:** `tn-` top-nav, `bt-` bottom-tab, `port-` portfolio, `sec-` securities, `wl-` watchlist, `sd-` stock-detail, `perf-` rendement, `cal-` agenda, `act-` mutaties, `kpi-`, `card-`, `modal-`, `sheet-`, `seg-`, `btn-`.
- Mobiel breakpoint: `@media (max-width:768px)`; extra compressie `≤440px` en `≤360px`.
- Geen `!important` tenzij nodig; geen utility-framework.
- Kleuren **alleen via tokens** (de twee thema's blijven dan consistent).

## Design patterns aanwezig
- **Pure compute layer** — alle cijfers afgeleid uit transactielog (geen running totals). Maakt Timetravel mogelijk (`getNowISO()`/`_ttDate` als virtuele "nu").
- **Config-driven kolommen** — `SEC_COLUMNS[]` (key/label/get/fmt/color) drijft tabel + card-detail + kolomkiezer.
- **Config-driven breakdowns** — `PORT_BREAKDOWNS[]` (sector/branche/type/land/marketcap/...) voor donut.
- **Adapter per databron** — `refreshTicker()` routeert crypto→CoinGecko, aandeel/ETF→Yahoo; `fxForCurrency()` met transactie-rate → cache-fallback.
- **Proxy-chain met cache** — `yahooFetch()` probeert werkende proxy eerst (`LS_YAHOO_PROXY`), valt door 4 proxies.
- **Static fallback maps** — `STATIC_TICKER_META`, `TICKER_DOMAINS`, `CRYPTO_TO_COINGECKO` voor data die de API's niet leveren.

## Functie-inventaris (grofweg, op volgorde in script)
- **Utils:** `uid`, `fmtEUR/fmtNum/fmtPct/fmtDate/fmtMonth`, `escapeHtml`, `getNowISO`, `timeAgo`, `appToast`, `setSync`.
- **State:** `initState`, `scheduleSave`, `saveGist`, `loadGist`, `activePortfolio`, `pfTransactions`, `pfDividends`, `pfWatchlist`, `getTicker`, `ensureTicker`.
- **Compute:** `computeHoldings`, `computeClosedHoldings`, `computeCash`, `buildValueSeries`, `valueAtDate`, `modifiedDietzReturn`, `computeMwrr`, `computeCagr`, `computeRealized`, `computeYtd`, `portfolioStats`, `fxForCurrency/fetchAndCacheFx`.
- **Fetch:** `yahooFetch`, `fetchYahooFullData`, `fetchYahooMetadata`, `fetchBenchmarkHistory`, `fetchCoinGeckoData`, `refreshCrypto`, `refreshTicker`, `refreshAllTickers`, `yahooSearch`, `isinToTicker`, `fetchFmpProfile`.
- **Render:** `renderAll`, `renderPortfolio`/`renderSecTable`/`renderPortBreakdownDonutAndLegend`, `renderPerformance`(+`renderPerf*`), `renderDividends`(+`renderDivModeChart`), `renderWatchlist`(+`renderWatchlistRows`), `renderCalendar`, `renderTransactions`, `renderHoldings`, `renderTickers`, `renderProjection`, `renderSettings`, `renderStockDetail*`.
- **Modals:** `openTxModal/saveTransaction`, `openDivModal`, `openTickerModal/saveTicker`, `openImportModal`(+CSV-parsers), `openWatchlistModal`(+search), `openStockDetail`, `openStratModal`, `openTtModal`, `openGistModal`, `openColPicker`, `openCalFilterSheet`, `openCustomEventModal`.

## Conventies voor wijzigingen (token-zuinig)
1. **Lees eerst de relevante `docs/`**; raakt de wijziging architectuur/datamodel → werk eerst de `.md` bij, dan de code.
2. Nieuw state-veld → default in `initState()` + hydratie + documenteer in `DATAMODEL.md`.
3. Nieuwe kolom → toevoegen aan `SEC_COLUMNS` (verschijnt automatisch in tabel + cards + kiezer).
4. Nieuwe route → `ROUTES` + nav-item (top-nav + bottom-tab indien primair).
5. `node validate.mjs` moet groen zijn vóór commit; NL-commit; push naar `main` (Action deployt).
6. **Beknopte diffs:** laat ongewijzigde code weg met `// ... bestaande code ...`.
