// Content Script: 动态内容注入
const KEYWORDS = ["election", "bitcoin", "trump", "fed", "interest rate", "crypto", "harris", "ai", "nvidia", "tesla", "gpt"];

function runCheck() {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q');
  if (!query) return;

  const matchedKeyword = KEYWORDS.find(word => query.toLowerCase().includes(word));
  
  if (matchedKeyword) {
    console.log("[PolySearch] Match found, fetching specific market data...");
    chrome.runtime.sendMessage({ 
      type: 'SEARCH_SPECIFIC_MARKET', 
      query: matchedKeyword 
    }, (response) => {
      if (response && response.success) {
        showPolymarketPrompt(response.title, response.price, response.slug, response.volume);
      }
    });
  }
}

function showPolymarketPrompt(title, price, slug, volume) {
  if (document.getElementById('polymarket-prompt')) return;

  const prompt = document.createElement('div');
  prompt.id = 'polymarket-prompt';
  prompt.innerHTML = `
    <div class="pm-container">
      <div class="pm-header-minimal">
        <div class="pm-logo-circle">
          <svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" /></svg>
        </div>
        <div class="pm-brand-name">POLYSEARCH ALPHA</div>
      </div>
      <div class="pm-title">${title}</div>
      <div class="pm-desc">
        胜率 <span class="pm-odds-badge">${price}%</span> 
        <span style="font-size:11px; color:#9ea3ae; margin-left:8px;">Vol: $${(volume/1000).toFixed(1)}k</span>
      </div>
      <div class="pm-actions">
        <button id="pm-close" class="pm-btn-secondary">忽略</button>
        <button id="pm-go" class="pm-btn-primary">参与预测</button>
      </div>
    </div>
  `;
  document.body.appendChild(prompt);

  document.getElementById('pm-close').onclick = () => prompt.remove();
  document.getElementById('pm-go').onclick = () => {
    window.open(`https://polymarket.com/event/${slug}`, '_blank');
  };
}

// 监听 URL 变化（处理 Google SPA）
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(runCheck, 1000);
  }
}).observe(document, { subtree: true, childList: true });

// 首次加载运行
runCheck();
