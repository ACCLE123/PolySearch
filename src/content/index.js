// Content Script 入口 — 步骤 7：cooldown + debounce + cache/abort 在 Background
console.log('PolySearch loaded');

const DEBOUNCE_MS = 400;
let scrollTimer = null;

// 处理滚动时的交互效果 (顶部收纳方案)
function handleScrollInteraction() {
  const root = document.getElementById('polysearch-root');
  if (!root || !root.shadowRoot) return;
  
  const container = root.shadowRoot.querySelector('.pm-container');
  if (!container) return;

  // 只要用户开始滚动，就进入收纳状态
  if (!container.classList.contains('pm-docked')) {
    container.classList.add('pm-docked');
    
    // 触发进度条动画：先重置为0，然后延迟触发填充
    const currentWidth = container.style.getPropertyValue('--prob-width') || '0%';
    const targetWidth = container.dataset.probability || '0';
    
    container.style.setProperty('--prob-width', '0%');
    setTimeout(() => {
      container.style.setProperty('--prob-width', `${targetWidth}%`);
    }, 200);
  }
}

// 监听滚动事件
window.addEventListener('scroll', handleScrollInteraction, { passive: true });

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
      choice: response.choice, // 增加选项显示
      slug: response.slug,
      icon: response.icon,
      price: response.price,
      volumeNum: response.volume,
      conditionId: response.conditionId,
      clobTokenIds: response.clobTokenIds,
      endDate: response.endDate
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
