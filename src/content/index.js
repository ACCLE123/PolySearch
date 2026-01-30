// Content Script 入口 — 步骤 7：cooldown + debounce + cache/abort 在 Background
console.log('PolySearch loaded');

const DEBOUNCE_MS = 400;

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

function scheduleRunSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runSearch, DEBOUNCE_MS);
}

let debounceTimer = null;
let lastQuery = getQuery();

// 首次加载：若已是搜索页且带 q，debounce 后发一次
if (lastQuery) scheduleRunSearch();

// 短轮询：URL 变化时 debounce 再发 SEARCH
setInterval(() => {
  const current = getQuery();
  if (current !== lastQuery) {
    lastQuery = current;
    if (current) scheduleRunSearch();
  }
}, 500);
