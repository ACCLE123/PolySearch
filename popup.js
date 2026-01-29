const MOCK_FALLBACK = [
  { question: "Bitcoin to hit $100k in 2026?", price: "65" },
  { question: "Next Fed rate cut in March?", price: "72" },
  { question: "Will GTA VI be delayed?", price: "15" }
];

function renderMarkets(markets) {
  const marketList = document.getElementById('marketList');
  marketList.innerHTML = '';
  
  const displayMarkets = Array.isArray(markets) ? markets : MOCK_FALLBACK;

  displayMarkets.slice(0, 5).forEach(market => {
    const name = market.title || market.question || "Market";
    let price = "50";
    
    if (market.markets && market.markets[0] && market.markets[0].outcomePrices) {
      try {
        const prices = JSON.parse(market.markets[0].outcomePrices);
        price = (parseFloat(prices[0]) * 100).toFixed(0);
      } catch(e) { price = "50"; }
    } else if (market.price) {
      price = market.price;
    }

    const item = document.createElement('div');
    item.className = 'market-item';
    item.innerHTML = `
      <span class="market-name">${name}</span>
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
