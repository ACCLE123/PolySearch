// Content Script 入口 — 步骤 5：收结果后先走 Matcher，只有匹配成功才展示
console.log('PolySearch loaded');

function runSearch() {
  const query = getQuery();
  if (!query) return;
  chrome.runtime.sendMessage({ type: 'SEARCH', query }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[PolySearch] sendMessage:', chrome.runtime.lastError.message);
      return;
    }
    if (!response || !response.list || response.list.length === 0) return;
    const market = matchBest(query, response.list);
    if (market) {
      console.log('[PolySearch] match found, showing result');
      showResult(market);
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
