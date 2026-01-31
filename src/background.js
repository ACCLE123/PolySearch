// Background Service Worker — 核心大脑：负责数据嗅探、语义匹配、缓存管理
import { fetchMarkets } from './api/polymarket.js';
import * as cache from './core/cache.js';
import { getSemanticScore, MarketIndex } from './core/matcher.js';
import { getOnchainMetrics, discoverLiveHotTokens } from './web3/onchainService.js';

const marketIndex = new MarketIndex();
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
                choice: m.groupItemTitle, // 记录具体选项（如 <250k）
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
      marketIndex.update(hotMarkets); // [新增] 更新倒排索引
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
      // 策略：先通过倒排索引检索候选集 (Retrieval)，然后用 BM25 重排序 (Ranking)
      let best = null;
      const corpusStats = marketIndex.getCorpusStats();
      const MIN_SCORE_THRESHOLD = 2.0; // BM25 最低分数阈值（过滤无意义搜索）
      
      // 1. [优化] 优先从倒排索引中召回候选集，极大减少向量计算量
      const candidates = marketIndex.search(cleanQuery);
      
      console.log(`%c [Match] 索引召回 ${candidates.length} 个候选`, "color: #3b82f6;");
      
      // 对所有候选者使用 BM25 打分
      const scoredCandidates = candidates.map((m, idx) => {
        const text = m.question || m.title || m.choice || "";
        const score = getSemanticScore(text, cleanQuery, corpusStats, idx === 0); // 仅对第一个候选打印 debug
        return { ...m, matchScore: score };
      });

      if (scoredCandidates.length > 0) {
        // 返回分数最高的，但需要超过阈值
        const topCandidate = scoredCandidates.sort((a, b) => b.matchScore - a.matchScore)[0];
        if (topCandidate.matchScore >= MIN_SCORE_THRESHOLD) {
          best = topCandidate;
          console.log(`%c [Match] 索引召回命中: ${best.question} (BM25 score: ${best.matchScore.toFixed(4)})`, "color: #10b981;");
        } else {
          console.log(`%c [Match] 最高分 ${topCandidate.matchScore.toFixed(4)} < 阈值 ${MIN_SCORE_THRESHOLD}，忽略结果`, "color: #ef4444;");
        }
      } else {
        // 2. 兜底：如果索引没中，尝试全局暴力匹配
        console.log(`%c [Match] 索引无结果，执行全局扫描...`, "color: #f59e0b;");
        const globalMatches = hotMarkets.map((m, idx) => {
          const text = m.question || m.title || "";
          const score = getSemanticScore(text, cleanQuery, corpusStats, idx === 0); // 仅对第一个打印 debug
          return { ...m, matchScore: score };
        });
        
        if (globalMatches.length > 0) {
          const topGlobal = globalMatches.sort((a, b) => b.matchScore - a.matchScore)[0];
          if (topGlobal.matchScore >= MIN_SCORE_THRESHOLD) {
            best = topGlobal;
            console.log(`%c [Match] 全局扫描命中: ${best.question} (BM25 score: ${best.matchScore.toFixed(4)})`, "color: #10b981;");
          } else {
            console.log(`%c [Match] 最高分 ${topGlobal.matchScore.toFixed(4)} < 阈值 ${MIN_SCORE_THRESHOLD}，忽略结果`, "color: #ef4444;");
          }
        }
      }

      // 3. API 兜底：使用 public-search 接口（支持全文搜索，/markets 会忽略 q 参数）
      if (!best) {
        console.log(`%c [Match] 本地无结果，请求 public-search API...`, "color: #f59e0b;");
        try {
          const res = await fetch(`https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(cleanQuery)}&limit_per_type=15`);
          const data = await res.json();
          const events = data?.events;
          if (Array.isArray(events) && events.length > 0) {
            const scored = events.map((evt, idx) => {
              const text = [evt.title, evt.description, evt.slug]
                .concat((evt.markets || []).map((m) => m.question || m.groupItemTitle || ""))
                .filter(Boolean)
                .join(" ");
              const score = getSemanticScore(text, cleanQuery, corpusStats, idx === 0);
              return { ...evt, matchScore: score };
            });
            const topAPI = scored.sort((a, b) => b.matchScore - a.matchScore)[0];
            if (topAPI && topAPI.matchScore >= MIN_SCORE_THRESHOLD) {
              const m0 = topAPI.markets?.[0];
              best = {
                slug: topAPI.slug,
                title: topAPI.title,
                question: topAPI.title,
                groupItemTitle: m0?.groupItemTitle,
                choice: m0?.groupItemTitle,
                icon: topAPI.icon,
                conditionId: m0?.conditionId,
                clobTokenIds: m0?.clobTokenIds,
                volume: topAPI.volume ?? m0?.volumeNum,
                volumeNum: topAPI.volume ?? m0?.volumeNum,
                outcomePrices: m0?.outcomePrices
              };
              try {
                best.price = best.outcomePrices
                  ? (parseFloat((typeof best.outcomePrices === 'string' ? JSON.parse(best.outcomePrices) : best.outcomePrices)[0]) * 100).toFixed(0)
                  : "50";
              } catch (_) {
                best.price = "50";
              }
              console.log(`%c [Match] public-search 命中: ${best.title} (BM25 score: ${topAPI.matchScore.toFixed(4)})`, "color: #10b981;");
            } else if (topAPI) {
              console.log(`%c [Match] API 最高分 ${topAPI.matchScore.toFixed(4)} < 阈值 ${MIN_SCORE_THRESHOLD}，忽略结果`, "color: #ef4444;");
            }
          }
        } catch (e) {
          console.error('[Match] API 请求失败:', e);
        }
      }

      if (best) {
        const eventSlug = (best.events && best.events[0] && best.events[0].slug) || best.slug;
        const eventTitle = (best.events && best.events[0] && best.events[0].title) || best.question || best.title || best.groupItemTitle;
        const eventIcon = best.icon || (best.events && best.events[0] && best.events[0].icon);
        const choice = best.choice || best.groupItemTitle; // 获取具体选项名

        sendResponse({
          success: true,
          title: eventTitle,
          choice: choice, // 传递选项名
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
