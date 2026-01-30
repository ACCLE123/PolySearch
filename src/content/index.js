// Content Script 入口 — 步骤 7：cooldown + debounce + cache/abort 在 Background
console.log('PolySearch loaded');

const DEBOUNCE_MS = 400;

async function runSearch() {
  const query = getQuery();
  if (!query) return;
  const inCooldown = await isInCooldown(query);
  if (inCooldown) return;

  chrome.runtime.sendMessage({ type: 'SEARCH_SPECIFIC_MARKET', query }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[PolySearch] sendMessage:', chrome.runtime.lastError.message);
      return;
    }
    if (!response || !response.success) return;
    
    // 构造一个兼容 showResult 的对象
    const market = {
      title: response.title,
      slug: response.slug,
      icon: response.icon,
      price: response.price,
      volumeNum: response.volume,
      conditionId: response.conditionId,
      clobTokenIds: response.clobTokenIds
    };

    console.log('[PolySearch] match found (Specific), showing result');
    showResult(market, query);
    
    chrome.runtime.sendMessage({ 
      type: 'FETCH_ONCHAIN', 
      conditionId: response.conditionId, 
      clobTokenIds: response.clobTokenIds, 
      slug: response.slug,
      isNegRisk: response.isNegRisk 
    }, (res) => {
      if (chrome.runtime.lastError) return;
      if (typeof updateOnchainMetrics === 'function') updateOnchainMetrics(res?.metrics ?? null);
    });
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
