# Herling Dividend Tracker

Single-file dividend & portfolio tracker. Open `index.html` in een moderne browser.

## Features

- Meerdere portefeuilles (Privé, Zakelijk, etc.)
- Transacties (koop / verkoop / dividend) handmatig of via CSV-import
- CSV-presets voor DeGiro, Interactive Brokers, Trading 212 (+ auto-detect)
- Dividend log met bruto/netto/bronbelasting per valuta
- Dashboard met KPI's, dividend per maand, cumulatieve groei, spreiding (sector/aandeel/land)
- Posities-overzicht met P&L, YOC, forward dividend
- Dividend kalender (ex-div + payment dates)
- Projectie-tool met DRIP (5/10/20 jaar)
- Ticker stamdata met Aristocrat badge
- Optionele cross-device sync via private GitHub Gist
- Dark / light / auto theme
- PWA (installeerbaar, werkt offline)

## Quick start

1. Open `index.html` direct in je browser, of host de map op GitHub Pages.
2. Voeg een transactie toe (knop rechtsboven), of importeer een CSV via de sidebar.
3. Optioneel: koppel een GitHub Gist via Instellingen om data over apparaten te syncen.

## Ontwikkelen

```bash
node validate.mjs    # syntax + structuur check
```

Zie [`CLAUDE.md`](CLAUDE.md) voor de volledige projectarchitectuur.
