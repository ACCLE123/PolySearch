// Polymarket Gamma API — 仅由 Background 引用
const GAMMA_BASE = 'https://gamma-api.polymarket.com';

/**
 * 按关键词拉取市场列表（events）
 * @param {string} query - 搜索词
 * @returns {Promise<Array>} events 数组，失败返回 []
 */
export async function fetchMarkets(query) {
  if (!query || typeof query !== 'string') return [];
  try {
    const url = `${GAMMA_BASE}/events?limit=10&active=true&closed=false&q=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url);
    const text = await res.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const list = JSON.parse(match[0]);
    return Array.isArray(list) ? list : [];
  } catch (err) {
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
