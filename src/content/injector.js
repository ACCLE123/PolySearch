// 向页面注入 Shadow DOM，毛玻璃弹窗 + 关闭/Dismiss（步骤 6）
const ROOT_ID = 'polysearch-root';

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
