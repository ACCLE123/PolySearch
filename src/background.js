// Background Service Worker — 消息处理、API 请求、缓存、abort/timeout、链上
import { fetchMarkets } from './api/polymarket.js';
import * as cache from './core/cache.js';
import { getOnchainMetrics, discoverLiveHotTokens } from './web3/onchainService.js';

let hotMarkets = []; // 存储活跃市场

// 新逻辑：通过链上嗅探发现真正的实时热点
async function refreshHotMarkets() {
  try {
    console.log("%c [Chain-First] 正在通过链上嗅探发现实时热点...", "color: #3b82f6;");
    
    // 1. 嗅探链上最活跃的 Token 列表
    const hotTokenIds = await discoverLiveHotTokens();
    const newHotMarkets = [];
    const seenSlugs = new Set();

    if (hotTokenIds && hotTokenIds.length > 0) {
      console.log(`%c [Chain-First] 嗅探到 ${hotTokenIds.length} 个活跃 Token，正在批量反查市场...`, "color: #10b981;");
      
      // 使用更高效的并发反查，获取更多市场 (目标 50-100 个)
      const CONCURRENCY = 15; // 并发请求数
      const targetTokens = hotTokenIds.slice(0, 150);
      
      for (let i = 0; i < targetTokens.length; i += CONCURRENCY) {
        const batch = targetTokens.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (tid) => {
          try {
            const res = await fetch(`https://gamma-api.polymarket.com/markets?clob_token_ids=${tid}`);
            const data = await res.json();
            if (data && data.length > 0) {
              const m = data[0];
              if (seenSlugs.has(m.slug)) return;
              seenSlugs.add(m.slug);

              newHotMarkets.push({
                title: m.question || m.groupItemTitle,
                slug: m.slug,
                question: m.question,
                conditionId: m.conditionId,
                clobTokenIds: typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds,
                isNegRisk: false,
                volume: Math.round(m.volumeNum || 0),
                price: m.outcomePrices ? (parseFloat(JSON.parse(m.outcomePrices)[0]) * 100).toFixed(0) : "50"
              });
            }
          } catch (e) {
            // 静默失败，继续下一个
          }
        }));
        
        // 如果已经收集够 100 个市场，可以提前结束
        if (newHotMarkets.length >= 100) break;
      }
    }

    // 2. 最终热点库：按交易额排序
    if (newHotMarkets.length > 0) {
      hotMarkets = newHotMarkets.sort((a, b) => b.volume - a.volume);
      console.log(`%c [Chain-Only] 实时链上热点已更新 (${hotMarkets.length} 个)`, "color: #10b981; font-weight: bold;");
      console.table(hotMarkets.map(m => ({
        Title: m.title,
        Volume: m.volume,
        Price: m.price + '%',
        Tokens: m.clobTokenIds?.join(', '),
        ConditionID: m.conditionId,
        Source: 'On-chain'
      })));
    } else {
      hotMarkets = [];
      console.warn("[Chain-Only] 过去 3.5 分钟全链无活跃成交，热点库暂时为空");
    }
  } catch (err) {
    console.error("[HotSync] 同步失败:", err);
  }
}

// 首次加载增加 1 秒延迟，确保网络环境就绪
setTimeout(refreshHotMarkets, 1000);
setInterval(refreshHotMarkets, 5 * 60 * 1000);

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
    // 优先返回链上嗅探到的实时热点
    if (hotMarkets && hotMarkets.length > 0) {
      sendResponse({ success: true, data: hotMarkets });
      return true;
    }
    
    // 兜底返回 API 默认事件
    handleFetch('https://gamma-api.polymarket.com/events?limit=10&active=true&closed=false')
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === 'SEARCH_SPECIFIC_MARKET') {
    const query = (request.query || "").toLowerCase().trim();
    console.log(`%c [Smart Match] 正在搜索: [${query}]`, "color: #f59e0b;");

    // 1. 组合搜索：优先 API 精准搜索，再从 Hot50 匹配
    const searchUrl = `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10&q=${encodeURIComponent(query)}`;
    
    handleFetch(searchUrl).then(data => {
      // 这里的 data 是 markets 数组，比 events 更精准
      let best = null;
      if (Array.isArray(data) && data.length > 0) {
        // 过滤出标题或问题包含关键词的
        best = data.find(m => 
          (m.groupItemTitle || m.question || "").toLowerCase().includes(query)
        ) || data[0];
      }

      if (best) {
        console.log(`%c [Smart Match] 发现市场: ${best.question}`, "color: #10b981;");
        sendResponse({
          success: true,
          title: best.question || best.groupItemTitle,
          slug: best.slug,
          question: best.question,
          conditionId: best.conditionId,
          clobTokenIds: typeof best.clobTokenIds === 'string' ? JSON.parse(best.clobTokenIds) : best.clobTokenIds,
          isNegRisk: false, // markets 接口通常是标准市场
          volume: Math.round(best.volumeNum || 0),
          price: best.outcomePrices ? (parseFloat(JSON.parse(best.outcomePrices)[0]) * 100).toFixed(0) : "50"
        });
      } else {
        // 兜底：推荐 Hot50 第一名
        sendResponse({ success: true, ...hotMarkets[0] });
      }
    }).catch(() => {
      sendResponse({ success: !!hotMarkets[0], ...hotMarkets[0] });
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

  // Step 8：链上指标 — 按 conditionId/clobTokenIds 拉取，失败静默
  if (request.type === 'FETCH_ONCHAIN') {
    const { conditionId, clobTokenIds, isNegRisk } = request;
    (async () => {
      try {
        const metrics = await getOnchainMetrics({ conditionId, clobTokenIds, isNegRisk });
        sendResponse({ metrics: metrics || null });
      } catch (e) {
        sendResponse({ metrics: null });
      }
    })();
    return true;
  }
});
