// chrome.storage.local 封装：dismiss 记录 + 冷却
const STORAGE_KEY = 'polysearch_dismissed';
const COOLDOWN_MS = 1 * 60 * 60 * 1000; // 1 小时

/**
 * 记录某 query 被用户 dismiss 的时间
 * @param {string} query - 归一化搜索词
 */
function setDismissed(query) {
  if (!query) return;
  chrome.storage.local.get(STORAGE_KEY, (prev) => {
    const data = prev[STORAGE_KEY] || {};
    data[query] = Date.now();
    chrome.storage.local.set({ [STORAGE_KEY]: data });
  });
}

/**
 * 是否在冷却期内（该 query 在 1h 内被 dismiss 过）
 * @param {string} query - 归一化搜索词
 * @param {number} [cooldownMs] - 冷却毫秒数，默认 1h
 * @returns {Promise<boolean>}
 */
function isInCooldown(query, cooldownMs = COOLDOWN_MS) {
  return new Promise((resolve) => {
    if (!query) {
      resolve(false);
      return;
    }
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const data = result[STORAGE_KEY] || {};
      const ts = data[query];
      resolve(!!(ts && Date.now() - ts < cooldownMs));
    });
  });
}
