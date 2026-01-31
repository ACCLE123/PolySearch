const MOCK_FALLBACK = [
  { question: "Bitcoin to hit $100k in 2026?", price: "65" },
  { question: "Next Fed rate cut in March?", price: "72" },
  { question: "Will GTA VI be delayed?", price: "15" }
];

const TOP_DISPLAY = 10;

function renderMarkets(markets) {
  const marketList = document.getElementById('marketList');
  const sectionTitle = document.querySelector('.section-title');
  marketList.innerHTML = '';

  const raw = Array.isArray(markets) ? markets : MOCK_FALLBACK;
  const displayMarkets = raw.slice(0, TOP_DISPLAY);

  if (sectionTitle) sectionTitle.innerText = `Hot Markets (${displayMarkets.length})`;
  const marketCount = document.getElementById('marketCount');
  if (marketCount) marketCount.innerText = displayMarkets.length;

  // 增加显示数量，优先使用链上数据格式
  displayMarkets.forEach(market => {
    const name = market.title || market.question || "Market";
    let price = "50";
    
    // 兼容多种 API 数据格式
    if (market.price) {
      price = market.price;
    } else if (market.markets && market.markets[0] && market.markets[0].outcomePrices) {
      try {
        const prices = JSON.parse(market.markets[0].outcomePrices);
        price = (parseFloat(prices[0]) * 100).toFixed(0);
      } catch(e) { price = "50"; }
    } else if (market.outcomePrices) {
      try {
        const prices = typeof market.outcomePrices === 'string' ? JSON.parse(market.outcomePrices) : market.outcomePrices;
        price = (parseFloat(prices[0]) * 100).toFixed(0);
      } catch(e) { price = "50"; }
    }

    const item = document.createElement('div');
    item.className = 'market-item';
    const iconUrl = market.icon || '';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex:1;overflow:hidden;">
        ${iconUrl ? `<img src="${iconUrl}" style="width:16px;height:16px;border-radius:50%;flex-shrink:0;">` : `<div style="width:16px;height:16px;background:#eee;border-radius:50%;flex-shrink:0;"></div>`}
        <span class="market-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
      </div>
      <span class="market-odds">${price}%</span>
    `;
    item.onclick = () => {
      const slug = market.slug || "";
      window.open(slug ? `https://polymarket.com/event/${slug}` : 'https://polymarket.com', '_blank');
    };
    marketList.appendChild(item);
  });
}

/**
 * 更新 Sniffer 状态展示（每 5 分钟链上拉取 token 的任务）
 * @param {{ scanning?: boolean, ok?: boolean, lastScanAt?: number } | null} status
 */
function updateSnifferStatus(status) {
  const el = document.getElementById('scanStatus');
  if (!el) return;
  if (!status) {
    el.textContent = '—';
    return;
  }
  if (status.scanning) {
    el.textContent = 'Scanning...';
    return;
  }
  if (status.ok && status.lastScanAt) {
    el.textContent = 'Live';
    return;
  }
  if (status.lastScanAt) {
    el.textContent = 'Failed';
    return;
  }
  el.textContent = 'Waiting...';
}

let refreshPollTimer = null;

function startRefreshPoll() {
  stopRefreshPoll();
  refreshPollTimer = setInterval(fetchMarkets, 2500);
}

function stopRefreshPoll() {
  if (refreshPollTimer) {
    clearInterval(refreshPollTimer);
    refreshPollTimer = null;
  }
}

function fetchMarkets() {
  const marketList = document.getElementById('marketList');
  marketList.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:#999;">Updating...</div>';

  chrome.runtime.sendMessage({ type: 'FETCH_MARKETS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Runtime Error:", chrome.runtime.lastError);
      renderMarkets(MOCK_FALLBACK);
      updateSnifferStatus(null);
      stopRefreshPoll();
      return;
    }

    if (response?.snifferStatus) {
      updateSnifferStatus(response.snifferStatus);
      if (response.snifferStatus.scanning) {
        startRefreshPoll();
      } else {
        stopRefreshPoll();
      }
    }

    if (response && response.success) {
      renderMarkets(response.data);
    } else {
      console.warn("API Failure, showing fallback. Error:", response ? response.error : 'No response');
      renderMarkets(MOCK_FALLBACK);
    }
  });
}

/**
 * Popup 搜索：先用 BM25 + API 智能匹配，命中则直接打开 event，否则回退到 Polymarket 搜索页
 */
function handlePopupSearch(query) {
  const q = (query || '').trim();
  if (!q) return;

  const searchInput = document.getElementById('searchInput');
  const origPlaceholder = searchInput?.placeholder || 'Search markets...';
  if (searchInput) {
    searchInput.disabled = true;
    searchInput.placeholder = 'Searching...';
  }

  chrome.runtime.sendMessage({ type: 'SEARCH_SPECIFIC_MARKET', query: q }, (response) => {
    if (searchInput) {
      searchInput.disabled = false;
      searchInput.placeholder = origPlaceholder;
    }
    if (chrome.runtime.lastError) {
      window.open(`https://polymarket.com/search?q=${encodeURIComponent(q)}`, '_blank');
      return;
    }
    if (response && response.success && response.slug) {
      window.open(`https://polymarket.com/event/${response.slug}`, '_blank');
    } else {
      window.open(`https://polymarket.com/search?q=${encodeURIComponent(q)}`, '_blank');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fetchMarkets();

  document.getElementById('goHome').onclick = () => window.open('https://polymarket.com', '_blank');

  document.getElementById('refreshBtn').onclick = () => fetchMarkets();
  document.getElementById('snifferStat').onclick = () => fetchMarkets();

  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && searchInput.value) {
      handlePopupSearch(searchInput.value);
    }
  });
});
