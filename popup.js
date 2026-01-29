const MOCK_FALLBACK = [
  { question: "Bitcoin to hit $100k in 2026?", price: "65" },
  { question: "Next Fed rate cut in March?", price: "72" },
  { question: "Will GTA VI be delayed?", price: "15" }
];

async function fetchMarkets() {
  const marketList = document.getElementById('marketList');
  marketList.innerHTML = '<div style="text-align:center;padding:20px;font-size:12px;color:#999;">Loading markets...</div>';

  try {
    // 使用 Gamma API 获取活跃市场，这通常是官网展示的数据来源
    const response = await fetch('https://gamma-api.polymarket.com/events?limit=5&active=true&closed=false');
    
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    
    marketList.innerHTML = '';
    
    // Gamma API 返回的是数组
    const markets = Array.isArray(data) ? data : (data.data || MOCK_FALLBACK);

    markets.slice(0, 5).forEach(market => {
      // 提取显示名称和价格
      const name = market.title || market.question || market.name;
      // 价格逻辑：尝试获取第一个市场的价格
      let price = "50";
      if (market.markets && market.markets[0] && market.markets[0].outcomePrices) {
        price = (JSON.parse(market.markets[0].outcomePrices)[0] * 100).toFixed(0);
      }

      const item = document.createElement('div');
      item.className = 'market-item';
      item.innerHTML = `
        <span class="market-name">${name}</span>
        <span class="market-odds">${price}%</span>
      `;
      item.onclick = () => {
        window.open(`https://polymarket.com/event/${market.slug}`, '_blank');
      };
      marketList.appendChild(item);
    });
  } catch (error) {
    console.warn("Using fallback due to API error:", error);
    renderFallback();
  }
}

function renderFallback() {
  const marketList = document.getElementById('marketList');
  marketList.innerHTML = '';
  MOCK_FALLBACK.forEach(market => {
    const item = document.createElement('div');
    item.className = 'market-item';
    item.innerHTML = `
      <span class="market-name">${market.question}</span>
      <span class="market-odds">${market.price}%</span>
    `;
    item.onclick = () => window.open(`https://polymarket.com/search?q=${encodeURIComponent(market.question)}`, '_blank');
    marketList.appendChild(item);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fetchMarkets();
  
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && searchInput.value) {
      window.open(`https://polymarket.com/search?q=${encodeURIComponent(searchInput.value)}`, '_blank');
    }
  });

  document.getElementById('goHome').onclick = () => window.open('https://polymarket.com', '_blank');
});
