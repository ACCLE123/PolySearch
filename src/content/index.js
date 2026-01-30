// Content Script 入口 — 步骤 3：取 query、发 SEARCH、收结果并展示第一个市场
console.log('PolySearch loaded');

function runSearch() {
  const query = getQuery();
  if (!query) return;
  chrome.runtime.sendMessage({ type: 'SEARCH', query }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[PolySearch] sendMessage:', chrome.runtime.lastError.message);
      return;
    }
    if (response && response.list && response.list.length > 0) {
      console.log('[PolySearch] received', response.list.length, 'markets');
      showResult(response.list[0]);
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
