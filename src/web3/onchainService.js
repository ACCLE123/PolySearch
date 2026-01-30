// 链上/活动指标：Polymarket Data API（trades by conditionId）+ 可选 Goldsky subgraph
const DATA_API_BASE = 'https://data-api.polymarket.com';
const ONCHAIN_TIMEOUT_MS = 8000;
const TWENTY_FOUR_H = 24 * 60 * 60;

function formatCompact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}

function formatVolume(usd) {
  if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(1) + 'M';
  if (usd >= 1e3) return '$' + (usd / 1e3).toFixed(1) + 'k';
  return '$' + Math.round(usd);
}

/**
 * 获取市场链上/活动指标（24h）
 * @param {string} marketKey - conditionId（0x 64 位 hex）优先；否则无法拉取
 * @returns {Promise<{ txCount: string, traders: string, volume: string, flowYes?: string, flowNo?: string } | null>}
 */
export async function getOnchainMetrics(marketKey) {
  if (!marketKey || typeof marketKey !== 'string') return null;
  const conditionId = marketKey.trim();
  if (!conditionId.startsWith('0x') || conditionId.length < 64) return null;

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), ONCHAIN_TIMEOUT_MS);

  try {
    const url = `${DATA_API_BASE}/trades?market=${encodeURIComponent(conditionId)}&limit=1000`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(to);
    if (!res.ok) return null;
    const raw = await res.json();
    const trades = Array.isArray(raw) ? raw : [];
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - TWENTY_FOUR_H;
    const last24h = trades.filter((t) => (t.timestamp || 0) >= cutoff);

    if (last24h.length === 0) return null;

    const wallets = new Set();
    let volumeUsd = 0;
    let volumeYes = 0;
    let volumeNo = 0;

    for (const t of last24h) {
      if (t.proxyWallet) wallets.add(t.proxyWallet);
      const size = Number(t.size) || 0;
      const price = Number(t.price) || 0;
      const v = size * price;
      volumeUsd += v;
      const outcome = (t.outcome || '').toLowerCase();
      if (outcome === 'yes') volumeYes += v;
      else if (outcome === 'no') volumeNo += v;
    }

    const txCount = formatCompact(last24h.length);
    const traders = formatCompact(wallets.size);
    const volume = formatVolume(volumeUsd);
    const totalOutcome = volumeYes + volumeNo;
    const flowYes = totalOutcome > 0 ? Math.round((volumeYes / totalOutcome) * 100) + '%' : undefined;
    const flowNo = totalOutcome > 0 ? Math.round((volumeNo / totalOutcome) * 100) + '%' : undefined;

    return { txCount, traders, volume, flowYes, flowNo };
  } catch (err) {
    clearTimeout(to);
    if (err?.name === 'AbortError') return null;
    return null;
  }
}
