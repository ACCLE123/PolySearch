const MOCK_FALLBACK = [
  { question: "Bitcoin to hit $100k in 2026?", price: "65" },
  { question: "Next Fed rate cut in March?", price: "72" },
  { question: "Will GTA VI be delayed?", price: "15" }
];

function renderMarkets(markets) {
  const marketList = document.getElementById('marketList');
  const sectionTitle = document.querySelector('.section-title');
  marketList.innerHTML = '';
  
  const displayMarkets = Array.isArray(markets) ? markets : MOCK_FALLBACK;
  
  if (sectionTitle) {
    sectionTitle.innerText = `Hot Markets (${displayMarkets.length})`;
  }

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

function fetchMarkets() {
  const marketList = document.getElementById('marketList');
  marketList.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:#999;">Updating...</div>';

  chrome.runtime.sendMessage({ type: 'FETCH_MARKETS' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Runtime Error:", chrome.runtime.lastError);
      renderMarkets(MOCK_FALLBACK);
      return;
    }

    if (response && response.success) {
      renderMarkets(response.data);
    } else {
      console.warn("API Failure, showing fallback. Error:", response ? response.error : 'No response');
      renderMarkets(MOCK_FALLBACK);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fetchMarkets();
  
  document.getElementById('goHome').onclick = () => window.open('https://polymarket.com', '_blank');
  
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && searchInput.value) {
      window.open(`https://polymarket.com/search?q=${encodeURIComponent(searchInput.value)}`, '_blank');
    }
  });
});
