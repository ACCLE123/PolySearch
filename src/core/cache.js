// Background 使用的内存缓存（Gamma API 结果），TTL 5 分钟
const TTL_MS = 5 * 60 * 1000;
const store = new Map();

/**
 * @param {string} query
 * @returns {{ list: Array }|null} 未过期则返回 { list }，否则 null
 */
export function get(query) {
  if (!query) return null;
  const entry = store.get(query);
  if (!entry || Date.now() - entry.ts > TTL_MS) return null;
  return { list: entry.data };
}

/**
 * @param {string} query
 * @param {Array} list
 */
export function set(query, list) {
  if (!query) return;
  store.set(query, { data: Array.isArray(list) ? list : [], ts: Date.now() });
}
