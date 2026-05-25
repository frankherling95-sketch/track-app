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
