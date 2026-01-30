// 向页面注入 Shadow DOM，毛玻璃弹窗 + 关闭/Dismiss + 链上区块（步骤 8）
const ROOT_ID = 'polysearch-root';

/**
 * 更新弹窗内的链上指标区块；无数据时隐藏
 * @param {{ txCount?: string, traders?: string, volume?: string, flowYes?: string, flowNo?: string } | null} metrics
 */
function updateOnchainMetrics(metrics) {
  const root = document.getElementById(ROOT_ID);
  if (!root || !root.shadowRoot) return;
  const block = root.shadowRoot.querySelector('[data-onchain-block]');
  if (!block) return;
  if (!metrics) {
    block.style.display = 'none';
    return;
  }
  block.style.display = '';
  block.classList.remove('pm-onchain-loading');
  const parts = [];
  if (metrics.txCount) parts.push(metrics.txCount + ' tx');
  if (metrics.traders) parts.push(metrics.traders + ' traders');
  if (metrics.volume) parts.push(metrics.volume);
  const line1 = parts.length ? 'On-chain: ' + parts.join(' · ') : '';
  const line2 = (metrics.flowYes != null && metrics.flowNo != null)
    ? `Flow: YES ${metrics.flowYes} · NO ${metrics.flowNo}` : '';
  const line3 = metrics.sentiment ? `<div class="pm-sentiment ${metrics.sentiment.toLowerCase()}">${metrics.sentiment} Signal</div>` : '';
  const radarLine = metrics.whaleRadar ? `<div class="pm-onchain-radar">📡 ${metrics.whaleRadar}</div>` : '';

  // 真相审计区块
  const truthLine = metrics.truthScore != null ? `
    <div class="pm-truth-box">
      <div class="pm-truth-header">
        <span>Truth Audit</span>
        <span class="pm-truth-status ${metrics.onchainStatus?.toLowerCase()}">${metrics.onchainStatus}</span>
      </div>
      <div class="pm-truth-bar"><div class="pm-truth-fill" style="width: ${metrics.truthScore}%"></div></div>
      <div class="pm-truth-desc">Credibility: ${metrics.truthScore}%</div>
    </div>
  ` : '';

  block.innerHTML = line3 + truthLine + radarLine + line1 + (line2 ? '<br><span class="pm-onchain-flow">' + line2 + '</span>' : '');
}

/**
 * 展示一个市场结果
 * @param {Object} event - Gamma API 的 event 对象，至少含 title、slug
 * @param {string} query - 当前搜索词，用于 dismiss 后写入 cooldown
 */
function showResult(event, query) {
  if (!event || !event.slug) return;
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  const shadow = root.attachShadow({ mode: 'open' });

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/styles/glass.css');
  shadow.appendChild(link);

  const title = (event.title || event.slug || 'Market').replace(/</g, '&lt;');
  const url = `https://polymarket.com/event/${event.slug}`;

  const wrap = document.createElement('div');
  wrap.className = 'pm-container';
  wrap.innerHTML = `
    <div class="pm-header-minimal">
      <div class="pm-logo-circle">
        <svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>
      </div>
      <div class="pm-brand-name">POLYSEARCH</div>
    </div>
    <div class="pm-title">${title}</div>
    <div class="pm-desc">Polymarket 预测市场</div>
    <div class="pm-onchain pm-onchain-loading" data-onchain-block>Loading on-chain…</div>
    <div class="pm-actions">
      <button type="button" class="pm-btn-secondary" data-action="dismiss">Dismiss</button>
      <a href="${url}" target="_blank" rel="noopener" class="pm-btn-primary" style="text-align:center;text-decoration:none;">Open</a>
    </div>
  `;

  wrap.querySelector('[data-action="dismiss"]').addEventListener('click', () => {
    if (query) setDismissed(query);
    root.remove();
  });

  shadow.appendChild(wrap);
  document.body.appendChild(root);
}
