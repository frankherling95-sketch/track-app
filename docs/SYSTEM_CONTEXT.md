# SYSTEM_CONTEXT

> Single source of truth voor "wat is dit en hoe hangt het samen". Lees dit eerst.

## Wat is de app
**Track** — een persoonlijke portfolio & dividend tracker (geïnspireerd op portfoliodividendtracker.com). Eén belegger, meerdere portefeuilles. Volgt aandelen/ETF's/crypto: posities, rendement, dividenden, agenda en een watchlist. Live URL: https://frankherling95-sketch.github.io/track-app/

## Tech stack (bewust minimalistisch)
| Laag | Keuze | Waarom |
|------|-------|--------|
| UI | **Eén `index.html`** (~6000 regels, alles inline) | Geen build-step, "open in browser = klaar" |
| JS | **Vanilla ES2020+** | Geen frameworks (geen React/Vue/jQuery) |
| CSS | Inline `<style>`, CSS custom properties | Eén design-systeem via tokens |
| Charts | **Handgetekende SVG-strings** | Geen chart-libs (geen Chart.js/Recharts) |
| Routing | **Hash routing** (`#portfolio` etc.) | Geen router-lib |
| Opslag | **localStorage** (primair) + **GitHub Gist** (sync) | Geen backend/database |
| Hosting | **GitHub Pages** via Actions | Auto-deploy bij push naar `main` |
| PWA | `manifest.json` + `sw.js` (stale-while-revalidate) | Installeerbaar, offline shell |

**Hard principe:** geen externe build, geen frameworks, geen backend. Alle staat leeft client-side.

## Externe data-bronnen (allemaal client-side fetch)
| Bron | Doel | Toegang |
|------|------|---------|
| **Yahoo Finance** (`query1/query2.finance.yahoo.com`) | Koersen, dividenden, ex-div, marketCap, historische koersen, search | Via CORS-proxy chain (4 proxies, fallback + cache) |
| **CoinGecko** (`api.coingecko.com`) | Crypto-koersen + historie | Direct (CORS-vriendelijk, geen key) |
| **Financial Modeling Prep** (optioneel) | Sector/branche/marketCap per ticker | User-eigen API-key in localStorage |
| **GitHub Gist API** | Cross-device sync van `rawState` | User PAT (`gist` scope) |
| Brand-logo's | `icons.duckduckgo.com/ip3/<domein>.ico` | Direct, fallback naar initial-badge |

Macro-events (CPI/NFP/FOMC/ECB) zijn **rule-based + hardcoded datums** — geen externe API.

## Globale dataflow
```
gebruiker-actie
   → muteert rawState (JS global object)
   → scheduleSave()  ──► localStorage (direct, vangnet)
                      └─► 1500ms debounce ──► saveGist() (PATCH, single-user, geen conflict-check)
   → renderAll()  ──► huidige route render-functie ──► innerHTML van #content

koers-data
   refreshAllTickers() / refreshWatchlist()
      → yahooFetch() (proxy-chain) of CoinGecko
      → schrijft prijs/dps/etc terug in rawState.tickers
      → cachet historie in _priceHistCache (in-memory) + localStorage (bench-prefix)
```

## Berekeningslaag (puur, leidt alles af uit het transactielog)
Alle cijfers zijn een **pure functie van `rawState.transactions` + `rawState.dividends` + koersen**. Niets wordt "saldo-matig" bijgehouden. Kernfuncties:
- `computeHoldings()` — open posities (gem. kostprijs, qty, realized)
- `computeCash()` — cash-saldo (0 als "cash uitsluiten" aan staat)
- `portfolioStats()` — geïnvesteerd, marktwaarde, forward dividend, YOC, yield
- `valueAtDate(iso)` / `buildValueSeries()` — historische waarde (met historische koersen)
- `modifiedDietzReturn()` / `computeMwrr()` / `computeCagr()` — rendement (geld-/tijd-gewogen)

→ Detail per functie: zie `ARCHITECTURE.md`. Data-vormen: zie `DATAMODEL.md`.

## Componenten / "modules" (geen aparte bestanden — secties in index.html)
5 hoofd-routes (top-nav desktop / bottom-tab mobiel) + secundaire routes via tandwiel-menu.
| Route | Functie |
|-------|---------|
| `#portfolio` | Donut-spreiding + effecten (tabel desktop / cards mobiel) + Aandelen/Crypto-toggle |
| `#performance` | Rendement / Vermogen / Kosten / Projectie sub-tabs + benchmarks |
| `#dividend` | Ontvangen vs PADI, per-aandeel, maand-grafiek |
| `#watchlist` | Monitoring zonder bezit, sparklines, timeframes, auto-refresh |
| `#calendar` | Ex-div/dividend/earnings/CMD/AGM + macro + eigen events |
| `#actions` | Mutatielog (CSV-import, handmatig) |
| secundair | `#holdings`, `#tickers`, `#projection`, `#settings` |

## Belangrijke randvoorwaarden
- **Eén gebruiker, nooit gelijktijdig** → Gist-sync overschrijft zonder conflict-check.
- **Taal: Nederlands** (UI én commits).
- **Privacy:** alle data in private Gist + localStorage; PAT alleen in localStorage, nooit in repo.
- **Validatie:** `node validate.mjs` (syntax + tag-balance) draait pre-push via git hook + GitHub Action.
