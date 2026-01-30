# PolySearch 🔍

**Search-driven prediction market discovery for Polymarket**

A Chrome extension that automatically surfaces relevant Polymarket prediction markets when you search on Google.

---

## Features

- **Smart Matching**: BM25 algorithm + inverted index for precise market discovery
- **On-chain Data**: Real-time transaction analysis from Polygon RPC nodes
- **Zero Latency**: Local hot market cache refreshed every 5 minutes
- **Clean UI**: Non-intrusive glassmorphism prompt via Shadow DOM
- **Privacy-first**: All processing happens locally in your browser

---

## How It Works

```
Google Search → BM25 Matching → Inverted Index Retrieval → Display Market Card
                                          ↓
                             On-chain Data (Polygon RPC) → Live Volume & Trades
```

### Matching Pipeline

1. **Inverted Index**: Fast candidate retrieval from 100+ hot markets (O(1) lookup)
2. **BM25 Scoring**: Industry-standard ranking algorithm used by Elasticsearch
3. **Exact Match Boost**: Additional weight for core keywords (btc, trump, nvidia, etc.)
4. **Threshold Filter**: Only shows results with score ≥ 2.0

### On-chain Intelligence

- Scans latest 100 blocks on Polygon every 5 minutes
- Parses `OrderFilled` events from Polymarket CLOB contract
- Identifies trending markets by transaction volume
- No API rate limits, direct RPC access

---

## Installation

1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** → Select project folder

---

## Tech Stack

- **Manifest V3** - Modern Chrome extension API
- **BM25** - Best Match 25 ranking algorithm
- **Inverted Index** - Sub-second retrieval from hot market cache
- **Polygon RPC** - Direct on-chain data via `eth_getLogs`
- **Shadow DOM** - Style isolation for UI injection

---

## Example Queries

Try searching on Google:
- `btc price` → Bitcoin markets
- `trump election` → US election markets
- `nvidia earnings` → NVIDIA-related markets

The extension automatically detects relevant markets and displays a card on the search page.

---

## Architecture

```javascript
/src
  /api          - Polymarket Gamma API client
  /core         - BM25 matcher + inverted index
  /web3         - Polygon RPC on-chain service
  /content      - DOM injection & UI logic
  /styles       - Glassmorphism CSS
  background.js - Service worker (market cache + matching coordinator)
```

---

## Performance

- **Index Build**: <50ms for 100 markets
- **Search Latency**: <5ms (inverted index) + <20ms (BM25 scoring)
- **Memory**: ~2MB for hot market cache
- **On-chain Sync**: 100 blocks every 5 minutes (~6 RPC calls)

---

## License

MIT
