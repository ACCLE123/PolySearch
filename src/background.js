// Background Service Worker — 核心大脑：负责数据嗅探、语义匹配、缓存管理
import { fetchMarkets } from './api/polymarket.js';
import * as cache from './core/cache.js';
import { getSemanticScore } from './core/matcher.js';
import { getOnchainMetrics, discoverLiveHotTokens } from './web3/onchainService.js';

let hotMarkets = []; // 全局实时热点库

/**
 * 核心任务：周期性从链上嗅探热门市场，并反查 API 补全元数据
 */
async function refreshHotMarkets() {
  try {
    console.log("%c [Core] 开始实时链上热点探测...", "color: #3b82f6;");
    
    // 1. 获取最活跃 Token 列表
    const hotTokenIds = await discoverLiveHotTokens();
    const newHotMarkets = [];
    const seenSlugs = new Set();

    if (hotTokenIds && hotTokenIds.length > 0) {
      const CONCURRENCY = 15;
      const targetTokens = hotTokenIds.slice(0, 150);
      
      for (let i = 0; i < targetTokens.length; i += CONCURRENCY) {
        const batch = targetTokens.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async (tid) => {
          try {
            const res = await fetch(`https://gamma-api.polymarket.com/markets?clob_token_ids=${tid}`);
            const data = await res.json();
            if (data && data.length > 0) {
              const m = data[0];
              const eventSlug = (m.events && m.events[0] && m.events[0].slug) || m.slug;
              if (seenSlugs.has(eventSlug)) return;
              seenSlugs.add(eventSlug);

              newHotMarkets.push({
                title: (m.events && m.events[0] && m.events[0].title) || m.question || m.groupItemTitle,
                slug: eventSlug,
                icon: m.icon || (m.events && m.events[0] && m.events[0].icon),
                question: m.question,
                conditionId: m.conditionId,
                clobTokenIds: typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds,
                volume: Math.round(m.volumeNum || 0),
                price: m.outcomePrices ? (parseFloat(JSON.parse(m.outcomePrices)[0]) * 100).toFixed(0) : "50"
              });
            }
          } catch (e) { /* ignore single error */ }
        }));
        if (newHotMarkets.length >= 100) break;
      }
    }

    // 2. 更新并排序热点库
    if (newHotMarkets.length > 0) {
      hotMarkets = newHotMarkets.sort((a, b) => b.volume - a.volume);
      console.log(`%c [Core] 链上热点就绪: ${hotMarkets.length} 个`, "color: #10b981; font-weight: bold;");
    }
  } catch (err) {
    console.error("[Core] 刷新失败:", err);
  }
}

// 启动周期性任务
setTimeout(refreshHotMarkets, 1000);
setInterval(refreshHotMarkets, 5 * 60 * 1000);

/**
 * 消息中心
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // 1. 弹出页数据请求
  if (request.type === 'FETCH_MARKETS') {
    if (hotMarkets.length > 0) {
      sendResponse({ success: true, data: hotMarkets });
    } else {
      fetch('https://gamma-api.polymarket.com/events?limit=15&active=true&closed=false')
        .then(r => r.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
    }
    return true;
  }

  // 2. 页面自动匹配 (核心功能)
  if (request.type === 'SEARCH_SPECIFIC_MARKET') {
    const query = (request.query || "").toLowerCase().trim();
    const noiseWords = ['price', 'prediction', 'market', 'will', 'hit', 'up', 'down', 'or', 'is', 'the', 'to'];
    const cleanQuery = query.split(/\s+/).filter(w => w.length > 1 && !noiseWords.includes(w)).join(' ') || query;

    if (cleanQuery.length < 2) {
      sendResponse({ success: false });
      return true;
    }

    (async () => {
      // 策略：先本地热点库匹配，没中再去 API
      let best = null;
      
      const localMatches = hotMarkets.map(m => ({
        ...m,
        matchScore: getSemanticScore(m.question || m.title || "", cleanQuery)
      })).filter(m => m.matchScore > 0.4);

      if (localMatches.length > 0) {
        best = localMatches.sort((a, b) => b.matchScore - a.matchScore)[0];
        console.log(`%c [Match] 本地库命中: ${best.question}`, "color: #10b981;");
      } else {
        try {
          const res = await fetch(`https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10&q=${encodeURIComponent(cleanQuery)}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            const scored = data.map(m => ({
              ...m,
              matchScore: getSemanticScore(m.question || m.groupItemTitle || "", cleanQuery)
            }));
            best = scored.filter(m => m.matchScore >= 0.45).sort((a, b) => b.matchScore - a.matchScore)[0];
            if (best) console.log(`%c [Match] API 命中: ${best.question}`, "color: #10b981;");
          }
        } catch (e) { /* ignore */ }
      }

      if (best) {
        const eventSlug = (best.events && best.events[0] && best.events[0].slug) || best.slug;
        const eventTitle = (best.events && best.events[0] && best.events[0].title) || best.question || best.title || best.groupItemTitle;
        const eventIcon = best.icon || (best.events && best.events[0] && best.events[0].icon);
        sendResponse({
          success: true,
          title: eventTitle,
          slug: eventSlug,
          icon: eventIcon,
          conditionId: best.conditionId,
          clobTokenIds: typeof best.clobTokenIds === 'string' ? JSON.parse(best.clobTokenIds) : best.clobTokenIds,
          volume: Math.round(best.volumeNum || best.volume || 0),
          price: best.price || (best.outcomePrices ? (parseFloat(JSON.parse(best.outcomePrices)[0]) * 100).toFixed(0) : "50")
        });
      } else {
        sendResponse({ success: false });
      }
    })();
    return true;
  }

  // 3. 链上深度分析
  if (request.type === 'FETCH_ONCHAIN') {
    getOnchainMetrics(request).then(metrics => sendResponse({ metrics }));
    return true;
  }

  // 4. 通用搜索
  if (request.type === 'SEARCH') {
    const q = request.query;
    const cached = cache.get(q);
    if (cached) {
      sendResponse({ list: cached });
      return true;
    }
    fetchMarkets(q).then(list => {
      cache.set(q, list);
      sendResponse({ list });
    });
    return true;
  }
});
