// Background Service Worker — 消息处理、API 请求、缓存、abort/timeout、链上
import { fetchMarkets } from './api/polymarket.js';
import * as cache from './core/cache.js';
import { getOnchainMetrics } from './web3/onchainService.js';

let searchController = null;
let searchTimeoutId = null;
const SEARCH_TIMEOUT_MS = 10000;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleFetch = async (url) => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (!match) throw new Error("No valid JSON found");
      return JSON.parse(match[0]);
    } catch (error) {
      console.error("Fetch error:", error);
      throw error;
    }
  };

  if (request.type === 'FETCH_MARKETS') {
    handleFetch('https://gamma-api.polymarket.com/events?limit=5&active=true&closed=false')
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === 'SEARCH_SPECIFIC_MARKET') {
    const url = `https://gamma-api.polymarket.com/events?limit=1&active=true&closed=false&q=${encodeURIComponent(request.query)}`;
    handleFetch(url)
      .then(data => {
        const event = data[0];
        if (event && event.markets && event.markets.length > 0) {
          const activeMarkets = event.markets.filter(m => m.active && !m.closed);
          if (activeMarkets.length === 0) return sendResponse({ success: false });
          let bestMarket = activeMarkets[0];
          let maxPrice = 0;
          let bestOutcomeIndex = 0;
          activeMarkets.forEach(m => {
            const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            const outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes;
            prices.forEach((p, idx) => {
              const currentPrice = parseFloat(p);
              if (currentPrice > maxPrice) {
                maxPrice = currentPrice;
                bestMarket = m;
                bestOutcomeIndex = idx;
              }
            });
          });
          const outcomes = typeof bestMarket.outcomes === 'string' ? JSON.parse(bestMarket.outcomes) : bestMarket.outcomes;
          const outcomeName = outcomes[bestOutcomeIndex];
          let displayTitle = bestMarket.question || event.title;
          if (outcomeName && !["Yes", "No"].includes(outcomeName)) {
            displayTitle = `${displayTitle} (${outcomeName})`;
          }
          sendResponse({
            success: true,
            title: displayTitle,
            price: (maxPrice * 100).toFixed(0),
            slug: event.slug,
            volume: Math.round(event.volumeNum || bestMarket.volumeNum || 0)
          });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch(err => {
        console.error("Search Error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  // Step 7：SEARCH — 先查缓存，再调 API；abort 上一次请求、超时
  if (request.type === 'SEARCH') {
    const query = request.query;
    const cached = cache.get(query);
    if (cached) {
      sendResponse(cached);
      return true;
    }
    if (searchController) searchController.abort();
    searchController = new AbortController();
    if (searchTimeoutId) clearTimeout(searchTimeoutId);
    searchTimeoutId = setTimeout(() => searchController.abort(), SEARCH_TIMEOUT_MS);

    (async () => {
      try {
        const list = await fetchMarkets(query, { signal: searchController.signal });
        cache.set(query, list);
        sendResponse({ list: list || [] });
      } catch (e) {
        if (e?.name !== 'AbortError') console.warn('[PolySearch] SEARCH failed:', e);
        sendResponse({ list: [] });
      } finally {
        if (searchTimeoutId) clearTimeout(searchTimeoutId);
        searchTimeoutId = null;
      }
    })();
    return true;
  }

  // Step 8：链上指标 — 按 conditionId/slug 拉取，失败静默
  if (request.type === 'FETCH_ONCHAIN') {
    const marketKey = request.conditionId || request.marketId || request.slug;
    (async () => {
      try {
        const metrics = await getOnchainMetrics(marketKey);
        sendResponse({ metrics: metrics || null });
      } catch (e) {
        sendResponse({ metrics: null });
      }
    })();
    return true;
  }
});
