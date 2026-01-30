// Content Script 入口 — 步骤 6：cooldown 检查 + 毛玻璃 UI + Dismiss
console.log('PolySearch loaded');

async function runSearch() {
  const query = getQuery();
  if (!query) return;
  const inCooldown = await isInCooldown(query);
  if (inCooldown) return;

  chrome.runtime.sendMessage({ type: 'SEARCH', query }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[PolySearch] sendMessage:', chrome.runtime.lastError.message);
      return;
    }
    if (!response || !response.list || response.list.length === 0) return;
    const market = matchBest(query, response.list);
    if (market) {
      console.log('[PolySearch] match found, showing result');
      showResult(market, query);
    }
  });
}

// 首次加载：若当前已是搜索页且带 q，发一次
runSearch();

// 短轮询：Google 搜索是 SPA，URL 变化时无整页刷新，轮询检测 q 变化
let lastQuery = getQuery();
setInterval(() => {
  const current = getQuery();
  if (current !== lastQuery) {
    lastQuery = current;
    if (current) runSearch();
  }
}, 500);
