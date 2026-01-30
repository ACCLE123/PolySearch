// Polymarket Gamma API — 仅由 Background 引用
const GAMMA_BASE = 'https://gamma-api.polymarket.com';

/**
 * 单次请求 Gamma：按 q 拉取 events
 */
async function fetchEventsByQuery(q, signal) {
  const url = `${GAMMA_BASE}/events?limit=15&active=true&closed=false&q=${encodeURIComponent(q.trim())}`;
  const res = await fetch(url, { signal });
  const text = await res.text();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const list = JSON.parse(match[0]);
  return Array.isArray(list) ? list : [];
}

/**
 * 按关键词拉取市场列表（events），支持 abort 与超时
 * 若整句搜索无结果且 query 含多词，会用首词再搜一次并合并去重（提高「Elon Musk」等命中率）
 * @param {string} query - 搜索词
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [opts] - 可选：abort 信号、超时毫秒
 * @returns {Promise<Array>} events 数组，失败返回 []
 */
export async function fetchMarkets(query, opts = {}) {
  if (!query || typeof query !== 'string') return [];
  const { signal } = opts;
  try {
    let list = await fetchEventsByQuery(query, signal);
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (list.length === 0 && words.length > 1) {
      const fallback = await fetchEventsByQuery(words[0], signal);
      const seen = new Set((list || []).map((e) => e.id || e.slug));
      for (const e of fallback || []) {
        const id = e.id || e.slug;
        if (id && !seen.has(id)) {
          seen.add(id);
          list.push(e);
        }
      }
    }
    return list || [];
  } catch (err) {
    if (err?.name === 'AbortError') return [];
    console.error('[PolySearch] Gamma API Error:', err);
    return [];
  }
}

// 兼容旧用法（可选）
export const PolymarketAPI = {
  async fetchTopMarkets(limit = 5) {
    const res = await fetch(`${GAMMA_BASE}/events?limit=${limit}&active=true&closed=false`);
    const text = await res.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No valid JSON found");
    return JSON.parse(match[0]);
  }
};
