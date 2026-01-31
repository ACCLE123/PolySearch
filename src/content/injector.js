// 向页面注入 Shadow DOM，毛玻璃弹窗 + 关闭/Dismiss + 链上区块（步骤 8）
const ROOT_ID = 'polysearch-root';
const NORESULT_TOAST_ID = 'polysearch-noresult-toast';

const NORESULT_DURATION_MS = 4000;

/**
 * 无匹配时显示短暂提示，数秒后自动消失
 */
function showNoResultToast() {
  const existing = document.getElementById(NORESULT_TOAST_ID);
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.id = NORESULT_TOAST_ID;
  const shadow = root.attachShadow({ mode: 'open' });

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/styles/glass.css');
  shadow.appendChild(link);

  const wrap = document.createElement('div');
  wrap.className = 'pm-toast pm-toast-visible';
  wrap.innerHTML = `
    <span class="pm-toast-icon">🔍</span>
    <span class="pm-toast-text">No Polymarket market found for this search</span>
  `;
  shadow.appendChild(wrap);
  document.body.appendChild(root);

  setTimeout(() => {
    wrap.classList.remove('pm-toast-visible');
    wrap.classList.add('pm-toast-fadeout');
    setTimeout(() => root.remove(), 350);
  }, NORESULT_DURATION_MS);
}

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

  block.innerHTML = '';
  // 暂时屏蔽详细链上指标，仅保留基础结构以待后续启用
  block.style.display = 'none';
}

/**
 * 模拟 Magic UI 的 NumberTicker 效果
 * @param {HTMLElement} el - 目标元素
 * @param {number} start - 起始值
 * @param {number} end - 结束值
 * @param {number} duration - 持续时间 (ms)
 */
/**
 * 模拟 Magic UI 的 NumberTicker 效果
 * @param {HTMLElement} el - 目标元素
 * @param {number} start - 起始值
 * @param {number} end - 结束值
 * @param {number} duration - 持续时间 (ms)
 * @param {boolean} useLocale - 是否使用千分位格式化
 */
function animateNumberTicker(el, start, end, duration = 1500, useLocale = false) {
  if (!el) return;
  const target = parseFloat(end);
  const startVal = parseFloat(start);
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // EaseOutQuart: 1 - (1 - x)^4
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const current = startVal + (target - startVal) * easeOutQuart;
    
    const val = Math.round(current);
    el.textContent = useLocale ? val.toLocaleString() : val;

    if (progress < 1) {
      window.requestAnimationFrame(update);
    } else {
      const finalVal = Math.round(target);
      el.textContent = useLocale ? finalVal.toLocaleString() : finalVal;
    }
  }

  window.requestAnimationFrame(update);
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
  const choice = event.choice; // 增加具体选项
  const url = `https://polymarket.com/event/${event.slug}`;
  const iconUrl = event.icon || '';
  const probability = parseFloat(event.price || '50');
  const endDate = event.endDate;
  const endDateFormatted = endDate ? (() => {
    try {
      const d = new Date(endDate);
      return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_) { return null; }
  })() : null;

  const wrap = document.createElement('div');
  wrap.className = 'pm-container';
  wrap.innerHTML = `
    <div class="pm-header-minimal pm-animate-item" style="transition-delay: 0.2s;">
      <div class="pm-logo-circle">
        ${iconUrl ? `<img src="${iconUrl}">` : `<svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z"/></svg>`}
      </div>
      <div class="pm-brand-name">POLYSEARCH</div>
    </div>
    <div class="pm-title pm-animate-item" style="transition-delay: 0.4s;">
      ${title}${choice && choice !== title ? ` <span class="pm-choice-inline">(${choice})</span>` : ''}
      ${choice && choice !== title ? `<div class="pm-choice-tag">Top Pick: ${choice}</div>` : ''}
    </div>
    
    <div class="pm-probability-container pm-animate-item" style="transition-delay: 0.6s;">
      <div style="flex: 1;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="pm-prob-label">Market Odds</span>
          <span class="pm-prob-value"><span data-prob-num>0</span><span class="pm-prob-unit">%</span></span>
        </div>
        <div class="pm-prob-bar-bg">
          <div class="pm-prob-bar-fill" style="width: 0%"></div>
        </div>
      </div>
    </div>

    <div class="pm-desc pm-annotations pm-animate-item" style="transition-delay: 0.8s;">
      Polymarket · Real-time Volume $<span data-volume-num>0</span>${endDateFormatted ? `<br>Ends: ${endDateFormatted}` : ''}
    </div>
    <div class="pm-onchain pm-onchain-loading" data-onchain-block style="display:none;"></div>
    <div class="pm-actions pm-animate-item" style="transition-delay: 1.0s;">
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

  // 存储 probability 到 dataset，供滚动动画使用
  wrap.dataset.probability = probability;

  // 触发入场动画：添加 pm-visible 类 (参考 Motion 触发方式)
  requestAnimationFrame(() => {
    wrap.classList.add('pm-visible');
    // 初始化胶囊进度条宽度为 0
    wrap.style.setProperty('--prob-width', '0%');
  });

  // 动画效果：初次入场时执行数字动画
  setTimeout(() => {
    const bar = wrap.querySelector('.pm-prob-bar-fill');
    const numEl = wrap.querySelector('[data-prob-num]');
    const volEl = wrap.querySelector('[data-volume-num]');
    
    const volume = parseFloat(event.volumeNum || 0);

    if (bar) {
      bar.style.width = `${probability}%`;
    }
    
    // 首次动画
    if (numEl) {
      animateNumberTicker(numEl, 0, probability, 2000);
    }

    if (volEl && volume > 0) {
      animateNumberTicker(volEl, 0, volume, 2000, true);
    }
  }, 700);

  // 监听悬停事件：展开和收缩时都执行数字动画
  let hoverTimer = null;
  let leaveTimer = null;
  let isAnimating = false;
  
  // 展开时的动画
  wrap.addEventListener('mouseenter', () => {
    if (!wrap.classList.contains('pm-docked') || isAnimating) return;
    
    clearTimeout(hoverTimer);
    clearTimeout(leaveTimer);
    
    // 重置胶囊进度条（展开时不需要显示）
    wrap.style.setProperty('--prob-width', '0%');
    
    hoverTimer = setTimeout(() => {
      isAnimating = true;
      
      const numEl = wrap.querySelector('[data-prob-num]');
      const volEl = wrap.querySelector('[data-volume-num]');
      const volume = parseFloat(event.volumeNum || 0);
      
      if (numEl) {
        numEl.textContent = '0';
        animateNumberTicker(numEl, 0, probability, 1200);
      }
      
      if (volEl && volume > 0) {
        volEl.textContent = '0';
        animateNumberTicker(volEl, 0, volume, 1200, true);
      }
      
      setTimeout(() => {
        isAnimating = false;
      }, 1300);
    }, 50);
  });
  
  // 收缩时的动画：触发胶囊进度条填充
  wrap.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    
    if (!wrap.classList.contains('pm-docked')) return;
    
    // 先重置进度条
    wrap.style.setProperty('--prob-width', '0%');
    
    // 延迟触发蓝色进度条填充动画
    leaveTimer = setTimeout(() => {
      wrap.style.setProperty('--prob-width', `${probability}%`);
    }, 200); // 让卡片先收缩到胶囊形态，然后触发进度条动画
  });
}
