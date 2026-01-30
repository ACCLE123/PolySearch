// 搜索词与市场的相关度评分、阈值判断、取 top1
// Content 通过 manifest 注入，与 index 同作用域，无需 export

/**
 * 从 (query, events) 中选出最相关的一个 event，低于阈值返回 null
 * @param {string} query - 已归一化的搜索词
 * @param {Array} events - Gamma API 返回的 events 数组
 * @returns {Object|null} 最相关的 event 或 null
 */
function matchBest(query, events) {
  if (!query || !events || !Array.isArray(events) || events.length === 0) return null;
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  let best = null;
  let bestScore = 0;
  const threshold = 1; // 至少一个 query 词出现在 title/description 中

  for (const event of events) {
    const title = (event.title || '').toLowerCase();
    const desc = (event.description || '').toLowerCase();
    const text = title + ' ' + desc;
    const score = words.filter(w => text.includes(w.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      best = event;
    }
  }

  if (bestScore < threshold) return null;
  return best;
}
