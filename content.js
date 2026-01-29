const POLYMARKET_EVENTS = [
  "election", "bitcoin", "trump", "fed", "interest rate", "crypto", "harris", 
  "world cup", "super bowl", "oscar", "ai", "nvidia", "tesla", "gpt"
];

function showPolymarketPrompt(matchedEvent) {
  if (document.getElementById('polymarket-prompt')) return;

  const prompt = document.createElement('div');
  prompt.id = 'polymarket-prompt';
  prompt.innerHTML = `
    <div class="pm-container">
      <div class="pm-header-minimal">
        <div class="pm-logo-circle">
          <svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" /></svg>
        </div>
        <div class="pm-brand-name">POLYSEARCH</div>
      </div>
      <div class="pm-title">发现预测市场</div>
      <div class="pm-desc">关于 <span class="pm-keyword-tag">${matchedEvent.toUpperCase()}</span> 的最新预测数据已上线，胜率波动中。</div>
      <div class="pm-actions">
        <button id="pm-close" class="pm-btn-secondary">忽略</button>
        <button id="pm-go" class="pm-btn-primary">查看实时胜率</button>
      </div>
    </div>
  `;

  document.body.appendChild(prompt);

  document.getElementById('pm-close').onclick = () => {
    prompt.classList.add('pm-fade-out');
    setTimeout(() => prompt.remove(), 400);
  };

  document.getElementById('pm-go').onclick = () => {
    window.open(`https://polymarket.com/search?q=${encodeURIComponent(matchedEvent)}`, '_blank');
  };
}

function runCheck() {
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q');
  if (!query) return;

  const match = POLYMARKET_EVENTS.find(event => query.toLowerCase().includes(event));
  if (match) {
    setTimeout(() => showPolymarketPrompt(match), 800);
  }
}

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(runCheck, 1000);
  }
}).observe(document, { subtree: true, childList: true });

runCheck();
