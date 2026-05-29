# Herling Dividend Tracker

> **Workflow (Documentation-Driven):** `docs/` is de single source of truth. Lees vóór elke wijziging
> `docs/SYSTEM_CONTEXT.md` (wat/waarom), `docs/ARCHITECTURE.md` (hoe), `docs/DATAMODEL.md` (datavormen).
> Raakt een wijziging architectuur of datamodel → werk EERST de betreffende `.md` bij, dan de code.
> Outputs beknopt: laat ongewijzigde code weg met `// ... bestaande code ...`.

Single-page dividend & portfolio tracker voor Frank Herling. Single-file HTML SPA, te hosten op GitHub Pages, optionele data-sync via een private GitHub Gist (los van de productivity app).

## Snel oriënteren

- **Hoofd-bestand**: `index.html` — alles inline, geen build step
- **Live URL**: nog niet uitgerold (lokaal openen werkt direct in de browser)
- **Zuster-app**: [Productivity App](../Productivity%20App/CLAUDE.md) — zelfde conventies, andere Gist

## Wie is de gebruiker

- **Eén gebruiker, één omgeving tegelijk.** Frank werkt vanuit meerdere computers, nooit tegelijk.
- **Taal: Nederlands** (UI én commit messages)
- **Achtergrond**: data analytics — comfortabel met SQL, Python, datamodellen

## Bestanden

```
.
├── index.html              ← DE app (alle wijzigingen hier)
├── dividend-icon.svg       ← logo + favicon
├── manifest.json, sw.js    ← PWA + Service Worker
├── validate.mjs            ← Node syntax/structure checker
├── CLAUDE.md               ← dit bestand
├── docs/                   ← deep-dives + decision log (nog leeg)
├── .githooks/              ← git hooks (na `core.hooksPath` setup)
└── .claude/                ← Claude Code config + hooks
```

## Modules (hash routing)

| Hash | Module | Functie |
|------|--------|---------|
| `#dashboard` | Dashboard | KPI's + dividend per maand + cumulatieve groei + spreiding |
| `#transactions` | Transacties | Koop/verkoop/dividend, handmatig + CSV import |
| `#dividends` | Dividenden | Ontvangen dividenden (bruto/netto/bronbelasting) |
| `#holdings` | Posities | Berekende posities, P&L, YOC per ticker |
| `#calendar` | Kalender | Komende ex-div en payment dates |
| `#projection` | Projectie | DRIP-calculator (5/10/20 jaar) |
| `#tickers` | Tickers | Ticker stamdata: koers, dividend, sector, frequentie |
| `#settings` | Instellingen | Portefeuilles, sync, thema, export/import |

Entry render-functions: `renderDashboard()`, `renderTransactions()`, `renderDividends()`, `renderHoldings()`, `renderCalendar()`, `renderProjection()`, `renderTickers()`, `renderSettings()`. `renderAll()` draait na elke state-mutatie en bij hashchange.

## State & persistence

```js
rawState = {
  portfolios:        [{id, name, createdAt}],
  activePortfolioId: '<id>',
  transactions:      [{id, portfolioId, type:'koop'|'verkoop'|'dividend', date, ticker, qty, price, fee, currency, fx, note}],
  dividends:         [{id, portfolioId, ticker, date, gross, tax, currency, fx, note}],
  tickers:           [{id, symbol, name, sector, country, currency, price, dps, freq, exDate, payDate, aristocrat}],
  settings:          {theme, baseCurrency}
}
```

### Storage keys

| Constant | Doel |
|----------|------|
| `GIST_FILENAME` = `herling_dividend_tracker.json` | File in de Gist |
| `LS_TOKEN_KEY` = `herling_dividend_gh_token` | GitHub PAT |
| `LS_GIST_KEY` = `herling_dividend_gist_id` | Gist ID |
| `LS_BACKUP_KEY` = `herling_dividend_state_v1` | Volledige rawState backup |

### Save flow

1. State-mutatie → `scheduleSave()` → direct naar `localStorage` (vangnet) → 1500ms debounce → `saveGist()`
2. `saveGist()` doet `PATCH /gists/:id` zonder conflict-check (single-user)
3. Bij netwerkfout: 5s retry; data blijft veilig in localStorage
4. Bij geen Gist: alles werkt offline, `setSync('idle', 'Lokaal')`
5. `beforeunload` flusht naar localStorage

### Berekende waarden (niet opgeslagen)

| Functie | Wat |
|---------|-----|
| `computeHoldings()` | Aggregeert koop/verkoop transacties → posities met avg cost |
| `portfolioStats()` | Geïnvesteerd, marktwaarde, forward dividend, YOC, yield, totaal ontvangen |

## Hard conventies

- **Geen externe build step** — alles inline.
- **Vanilla JS** — geen frameworks.
- **Geen externe chart-libs** — SVG handmatig getekend (bar, line, pie).
- **Geen analytics, geen cookies**. Data privé in Gist + localStorage.
- **CSV parser** is intern (geen PapaParse) — supports comma/semicolon, quoted fields, BOM.
- **FX-koers** is per-transactie veld (geen live API). Default 1.0 voor EUR-transacties.
- **FX-conversie naar EUR voor ticker-prijzen**: `fxForCurrency(currency)` pakt de meest recente fx-koers uit transacties/dividenden van die valuta. Geen rate beschikbaar → 1.0 (waarschijnlijk fout, vul handmatig een transactie met fx in).
- **Yahoo Finance**: `fetchYahooFullData(symbol)` via CORS-proxy chain (`api.allorigins.win` → `corsproxy.io` → `api.codetabs.com` → `thingproxy.freeboard.io`). Eerst-werkende proxy wordt gecached in `LS_YAHOO_PROXY`. Endpoint: `query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=2y&events=div`. Levert: price, currency, name, dps (som van laatste 12 mnd dividenden), freq (afgeleid uit aantal dividenden per jaar), lastExDate. **Beperking**: chart-endpoint geeft GEEN sector/industry/country — die blijven handmatig. Voor die data zou `quoteSummary` endpoint nodig zijn maar dat vereist een Yahoo-crumb cookie die in de browser niet stabiel werkbaar is.

## CSV broker presets

In `BROKER_PRESETS` (zoek in `index.html`): kolom-mappings voor DeGiro, Interactive Brokers, Trading 212. Auto-detect probeert deze in volgorde. Voor nieuwe broker: voeg sleutel toe, geef per veld een lijst met header-namen die in CSV voorkomen.

## Theme

- `auto` (default, volgt `prefers-color-scheme`), `light`, `dark`
- Manual: `:root[data-theme="..."]`
- Voorkeur in `rawState.settings.theme`

**Color tokens** (overgenomen uit productivity app): `--navy #0F1B3D`, `--teal #0D3D3A`, `--mint #00E5B0`, plus `--bg/--surface/--text/--border/--accent/--danger/--success/--gold`.

## Mobile

- **Breakpoint**: `@media (max-width: 768px)`
- Sidebar als drawer (`.sidebar.open`), scrim achter, hamburger-knop in topbar
- KPI grid 2 kolommen, chart grid 1 kolom

## Workflow

```bash
# Voor elke wijziging:
grep -n "<symbol>" index.html       # check refs voor je iets wijzigt

# Edit index.html
node validate.mjs                   # MOET groen zijn

git add index.html
git commit -m "Korte Nederlandse beschrijving"
git push
```

## Bekende valkuilen

| Probleem | Oplossing |
|----------|-----------|
| Onclick warning `if` in validate | False positive — regex matcht `onclick="if(...)..."`. Negeren. |
| CSV import slaat rijen over | Check kolom-mapping; datums in onverwachte formats (parser supports ISO/DD-MM-YYYY/MM-DD-YYYY) |
| Forward dividend = 0 | Ticker mist `dps` (dividend per aandeel) — open ticker via Posities of Tickers module |
| Posities verschijnen niet | `computeHoldings()` filtert op qty > 0; check of koop-transacties allemaal in actieve portefeuille zitten |
| Gist sync error | Token verlopen of mist `gist` scope; reconnect via Instellingen |

## Glossarium

| Term | Betekenis |
|------|-----------|
| Portfolio | Aparte verzameling transacties/dividenden (Privé / Zakelijk) |
| Position / Holding | Berekende open positie per ticker (qty + avg cost) |
| YOC | Yield on Cost — forward dividend / kostprijs |
| Forward dividend | Verwacht dividend komende 12 maanden = qty × dps |
| DRIP | Dividend Reinvestment — herinvesteer ontvangen dividend in projectie |
| Ex-div datum | Laatste datum waarop je aandeel moet bezitten om dividend te ontvangen |
| Aristocrat | Aandeel dat 25+ jaar achtereen dividend verhoogd heeft |
