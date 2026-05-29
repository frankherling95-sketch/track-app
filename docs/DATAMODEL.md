# DATAMODEL

> Alle datastructuren. Geen database — alles leeft in het globale `rawState` object (JSON), gepersisteerd in localStorage + GitHub Gist.

## Root: `rawState`
```js
rawState = {
  portfolios:        [Portfolio],
  activePortfolioId: string,        // id van actieve portefeuille
  transactions:      [Transaction], // ALLE portefeuilles (filter op portfolioId)
  dividends:         [Dividend],
  tickers:           [Ticker],      // stamdata, gedeeld over portefeuilles (key = symbol)
  strategies:        [Strategy],
  watchlists:        [WatchlistItem],
  events:            [CustomEvent],
  settings:          Settings
}
```
> **Let op:** transactions/dividends/watchlists horen bij een portefeuille via `portfolioId`. `tickers` zijn globaal (stamdata per symbool). Helpers `pfTransactions()/pfDividends()/pfWatchlist()` filteren op `activePortfolioId`.

## Entiteiten

### Portfolio
```js
{ id, name, createdAt }   // bv. { id:'abc', name:'Privé', createdAt:ISO }
```

### Transaction
```js
{
  id, portfolioId,
  type,        // 'koop' | 'verkoop' | 'dividend'
               // cash-types: 'storting' | 'opname' | 'broker_fee' | 'stamp_duty'
               //             'securities_lending' | 'dividend_correction' | 'currency_conversion'
  date,        // 'YYYY-MM-DD'
  ticker,      // symbool, '' voor cash-types
  qty, price,  // per aandeel (native currency)
  amount,      // alleen cash-types (bedrag)
  fee,         // transactiekosten
  currency,    // 'EUR'|'USD'|'GBP'|...
  fx,          // koers → EUR (1 voor EUR). TR-import = altijd 1 (al omgerekend)
  note, txId,  // txId = broker transactie-id (dedup bij import)
  createdAt
}
```
**Conventies:** bedragen in EUR = `qty*price*fx` (+/− fee). `qty` ondersteunt fracties (bv. 0.1894). Kostprijs-methode = **gemiddeld** (niet FIFO).

### Dividend
```js
{ id, portfolioId, ticker, date, gross, tax, currency, fx, note, createdAt }
// netto EUR = (gross - tax) * fx
```

### Ticker (stamdata, key = symbol)
```js
{
  id, symbol,            // bv. 'AAPL', 'ASML.AS', 'BTC'
  name, type,            // type: 'stock'|'etf'|'bond'|'fund'|'crypto'|'metal'|'reit'|'other'
  sector, industry, country, currency,
  price,                 // laatste koers (native currency)
  dps, freq,             // dividend/aandeel per jaar, betalingen/jaar (1/2/4/12)
  exDate, payDate, earnDate, cmdDate, agmDate,  // 'YYYY-MM-DD' of null
  marketCap, exchange,
  broker, strategyId,    // strategyId → Strategy.id
  aristocrat,            // bool
  domain,                // optioneel, override voor logo
  lastFetchedAt          // ISO, voor stale-detectie
}
```
**Crypto:** `symbol` zonder suffix (`BTC`), `type:'crypto'`; lookup via `CRYPTO_TO_COINGECKO`. Yahoo-koers voor crypto vereist `-EUR` suffix (daarom aparte CoinGecko-route).

### Strategy
```js
{ id, name, color, targetPct }   // defaults: GARP, Growth, Value, Dividend
```

### WatchlistItem
```js
{ id, portfolioId, ticker, addedAt, note, targetPrice, createdAt }
```

### CustomEvent (eigen agenda-items)
```js
{ id, portfolioId, date, title, emoji, note, createdAt }
```

### Settings
```js
{
  theme,              // 'auto' | 'light' | 'dark'
  baseCurrency,       // 'EUR'
  excludeCashFlows,   // bool (default true): vermogen = posities×koers, cash genegeerd
  autoRefresh,        // bool: koersen verversen bij openen als >20u oud
  wlAutoRefreshMinutes // 0|15|60|240: watchlist auto-refresh interval
}
```

## Afgeleide structuren (compute, niet opgeslagen)

### Holding (uit `computeHoldings()`)
```js
{ ticker, qty, costEur, realizedEur }   // open positie; costEur = gem. kostprijs basis in EUR
```
`computeClosedHoldings()` → idem met `qty≈0` + `exitDate` (alleen realized).

### portfolioStats() → 
```js
{ invested, currentValue, forwardDiv, yoc, yieldNow, received, holdings }
```

### buildValueSeries() → `[{ date, invested, marketValue, cash, total }]` (per maand, met historische koersen)

## localStorage keys
| Key (constante) | Inhoud |
|-----------------|--------|
| `LS_BACKUP_KEY` (`herling_dividend_state_v1`) | volledige `rawState` (vangnet) |
| `LS_TOKEN_KEY` | GitHub PAT (gist scope) |
| `LS_GIST_KEY` | Gist ID |
| `LS_FMP_KEY` | Financial Modeling Prep API-key (optioneel) |
| `LS_YAHOO_LAST` | timestamp laatste koers-refresh |
| `LS_YAHOO_PROXY` | index van laatst-werkende CORS-proxy |
| `LS_FX_CACHE` | `{ USD:{rate,ts}, ... }` FX→EUR |
| `LS_BENCH_PREFIX + symbol_range` | gecachte koershistorie (4u TTL) |
| `LS_PORT_COLUMNS` | gekozen effecten-kolommen (keys uit SEC_COLUMNS) |
| `LS_WL_LAST_REFRESH` | timestamp laatste watchlist-refresh |
| `LS_LAST_IMPORT` / `LS_LAST_GIST_SYNC` | timestamps voor "Data status" |

## Gist-bestand
Eén bestand `herling_dividend_tracker.json` = `JSON.stringify(rawState)`.

## Config-arrays (drijven UI, in code gedefinieerd — geen state)
- `SEC_COLUMNS[]` — effecten-kolommen `{key,label,def,num,get(h,tk),fmt(v,h,tk),color}`.
- `PORT_BREAKDOWNS[]` — donut-dimensies `{key,label,getter(tk)}`.
- `WL_TIMEFRAMES[]` — `1d/1w/1m/3m/ytd/since_added`.
- `CAL_EVENT_TYPES[]` + `CAL_MACRO_TYPES[]` — agenda event-types.
- `BENCHMARKS[]` — `^AEX / ^GSPC(S&P500) / URTH(MSCI World)`.
- `STATIC_TICKER_META`, `TICKER_DOMAINS`, `CRYPTO_TO_COINGECKO`, `MACRO_FIXED_DATES` — fallback/mapping-tabellen.

## Migratie-regel
Nieuw veld op bestaande entiteit → default zetten in `initState()` (state-niveau) of `ensureTicker()` (ticker-niveau), zodat oude Gist-data blijft werken. Documenteer het veld hier.
