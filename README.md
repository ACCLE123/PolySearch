# PolySearch 🔍

**Search-driven prediction market discovery for Polymarket**

A Chrome extension that automatically surfaces relevant Polymarket prediction markets when you search on Google.

---

## Features

- **Smart Matching**: BM25 ranking + inverted index + API fallback for precise market discovery
- **Three-Tier Search**: Index recall → Global scan → Polymarket `public-search` API
- **On-Chain Sniffer**: Fetches hot markets from Polygon every 5 minutes via `OrderFilled` logs
- **Popup Hub**: Search markets, browse top 10 trending, live sniffer status
- **Google Integration**: Auto-injects a market card on search results when a relevant market exists
- **No-Result Feedback**: Toast message when no match is found (auto-dismisses in 4 seconds)
- **Privacy-First**: Processing runs locally in your browser

---

## How It Works

```
Google Search
    → Query Detection
    → BM25 Matching (Index ← hotMarkets ← On-chain Sniffer / Polygon RPC)
    → Global Scan (if index empty)
    → API Fallback (public-search)
    → Score ≥ 2.0?
        ├─ Yes → Market Card (Volume · Ends · Top Option · On-chain metrics)
        └─ No  → Toast: "No Polymarket market found for this search"

On-chain: 5-min sync → Live Volume & Trades (Polygon RPC)
```

### Matching Pipeline

1. **Index Recall**: O(1) lookup from ~100 hot markets using inverted index (exact + fuzzy prefix match)
2. **Global Scan**: If index returns nothing, score all hot markets with BM25
3. **API Fallback**: If still no result, call Polymarket `public-search` API and score events
4. **BM25 + Boosts**: Term frequency, IDF, exact-match (+5), substring match (+1, ignores single-char tokens to avoid O/U false positives)
5. **Threshold**: Only shows results with score ≥ 2.0

### Popup

- **Search**: Enters your query into the same matching pipeline; opens the event page if found, otherwise Polymarket search
- **Trending Markets**: Top 10 from the on-chain sniffer cache, click to open
- **Sniffer Status**: Live / Scanning / Failed / Waiting; refreshes on click; auto-polls while scanning

### On-chain Intelligence

- Scans latest blocks on Polygon every 5 minutes
- Parses `OrderFilled` events from Polymarket CLOB contract
- Ranks markets by transaction volume; enriches via Gamma API

---

## Installation

1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** → Select project folder

---

## Tech Stack

- **Manifest V3** — Chrome extension API
- **BM25** — Ranking algorithm (k1=1.5, b=0.75)
- **Inverted Index** — Fast retrieval from hot market cache
- **Polymarket Gamma API** — `public-search` for fallback
- **Polygon RPC** — On-chain data via `eth_getLogs`
- **Shadow DOM** — Isolated UI injection on Google

---

## Example Queries

Search for topics you care about (people, companies, events). The extension will show a Polymarket market card when a relevant, active market exists. Try queries like:

- Names: `trump`, `elon musk`
- Companies: `apple`, `nvidia`, `lululemon`
- Events: `election`, `bitcoin`, `fed rate`

No match? A brief toast will tell you.

---

## Architecture

```
/src
/api             — Polymarket Gamma API client
/core            — BM25 matcher + inverted index + cache
/web3            — Polygon RPC on-chain service
/content         — DOM injection & UI logic
/styles          — Glassmorphism CSS
background.js    — Service worker (sniffer + matching coordinator)
popup.html/js    — Popup UI
```

---

## Performance

- **Index Build**: <50ms for ~100 markets
- **Search**: <5ms (index) + <20ms (BM25) for local; ~200ms for API fallback
- **Memory**: ~2MB for hot market cache
- **On-Chain Sync**: 100 blocks every 5 minutes (~6 RPC calls)

---

## License

MIT
