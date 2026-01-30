// 向页面注入 Shadow DOM，渲染最简提示（步骤 3：一个块 + 一个链接）
const ROOT_ID = 'polysearch-root';

/**
 * 展示一个市场结果
 * @param {Object} event - Gamma API 的 event 对象，至少含 title、slug
 */
function showResult(event) {
  if (!event || !event.slug) return;
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  const shadow = root.attachShadow({ mode: 'open' });
  const title = (event.title || event.slug || 'Market').replace(/</g, '&lt;');
  const url = `https://polymarket.com/event/${event.slug}`;

  shadow.innerHTML = `
    <div style="
      position: fixed; top: 16px; right: 16px; z-index: 999999;
      max-width: 360px; padding: 14px 16px;
      background: rgba(255,255,255,0.92); border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12); font-family: system-ui, sans-serif;
      font-size: 14px; line-height: 1.4; color: #111;
    ">
      <div style="font-weight: 600; margin-bottom: 8px;">${title}</div>
      <a href="${url}" target="_blank" rel="noopener" style="
        display: inline-block; margin-top: 8px; padding: 6px 12px;
        background: #0d6efd; color: #fff; text-decoration: none; border-radius: 8px;
        font-size: 13px; font-weight: 500;
      ">Open</a>
    </div>
  `;

  document.body.appendChild(root);
}
