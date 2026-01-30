// 链上数据服务：直接从 Polygon RPC 节点解析原始 Event Logs

const POLYGON_RPC_NODES = [
  "https://1rpc.io/matic",
  "https://polygon-rpc.com",
  "https://polygon.llamarpc.com",
  "https://rpc-mainnet.maticvigil.com"
];

const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const ORDER_FILLED_TOPIC0 = "0x63bf4d16b7fa898ef4c4b2b6d90fd201e9c56313b65638af6088d149d2ce956c";
const CLOB_EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// 统一区块扫描窗口配置 (100 块约 3.5 分钟)
const SCAN_WINDOW = 100;
const STABLE_OFFSET = 50;

const parseHex = (hex) => (hex || "").startsWith('0x') ? hex.slice(2) : hex;

/**
 * 健壮的 RPC 调用器：支持多节点自动切换与超时
 */
const callRPC = async (method, rpcParams) => {
  let lastError = "";
  for (const url of POLYGON_RPC_NODES) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: "2.0", method, params: rpcParams, id: Date.now() }),
        signal: AbortSignal.timeout(6000)
      });
      
      if (!response.ok) continue;

      const json = await response.json();
      if (json && json.result !== undefined) return json;
      if (json && json.error) lastError = json.error.message;
    } catch (e) {
      lastError = e.message;
    }
  }
  return { error: `All nodes failed. Last: ${lastError}` };
};

/**
 * 获取扫描区块范围
 */
async function getStableBlockRange() {
  const blockData = await callRPC("eth_blockNumber", []);
  const latest = parseInt(blockData?.result || "0x0", 16);
  if (!latest) return null;

  return {
    from: '0x' + Math.max(0, latest - (SCAN_WINDOW + STABLE_OFFSET)).toString(16),
    to: '0x' + Math.max(0, latest - STABLE_OFFSET).toString(16),
    latest
  };
}

/**
 * 链上嗅探：发现当前全网最活跃的 Token 列表
 */
export async function discoverLiveHotTokens() {
  try {
    const range = await getStableBlockRange();
    if (!range) return [];

    const res = await callRPC("eth_getLogs", [{ 
      fromBlock: range.from, 
      toBlock: range.to, 
      address: CLOB_EXCHANGE_ADDRESS, 
      topics: [ORDER_FILLED_TOPIC0] 
    }]);

    const logs = res.result || [];
    if (logs.length === 0) return [];

    const counts = {};
    logs.forEach(log => {
      const data = parseHex(log.data);
      if (data.length < 128) return;
      [data.substring(0, 64), data.substring(64, 128)].forEach(id => {
        const cleanId = id.toLowerCase();
        if (cleanId.includes('00000000000000000000000000000000')) return;
        counts[cleanId] = (counts[cleanId] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200)
      .map(entry => BigInt('0x' + entry[0]).toString());
  } catch (e) {
    return [];
  }
}

/**
 * 获取具体市场的链上核心指标
 */
export async function getOnchainMetrics(params) {
  const { conditionId, clobTokenIds } = params;
  if (!clobTokenIds || !Array.isArray(clobTokenIds)) return null;

  try {
    const range = await getStableBlockRange();
    if (!range) return null;

    // 1. 状态查询：是否已结项
    const getCtfState = async (fnSelector, cid) => {
      if (!cid || !cid.startsWith('0x')) return "0x0";
      const data = '0x' + fnSelector.replace('0x','') + cid.replace('0x','').padStart(64, '0');
      const res = await callRPC("eth_call", [{ to: CTF_CONTRACT, data }, "latest"]);
      return res.result || "0x0";
    };

    const [slotCountHex, denominatorHex] = await Promise.all([
      getCtfState("0x56086f6f", conditionId),
      getCtfState("0x90297274", conditionId)
    ]);

    const slotCount = parseInt(slotCountHex, 16);
    const isResolved = BigInt(denominatorHex) > 0n;
    const existsOnchain = slotCount > 0;

    // 2. 成交雷达：近期大单探测
    const radarRes = await callRPC("eth_getLogs", [{ 
      fromBlock: range.from, 
      toBlock: range.to, 
      address: CLOB_EXCHANGE_ADDRESS, 
      topics: [ORDER_FILLED_TOPIC0] 
    }]);

    const allLogs = radarRes.result || [];
    let matchCount = 0;
    let whaleTrade = null;

    for (const log of allLogs) {
      const data = parseHex(log.data);
      const m_id = data.substring(0, 64).toLowerCase();
      const t_id = data.substring(64, 128).toLowerCase();
      
      const isTarget = clobTokenIds.some(id => {
        const hexId = BigInt(id).toString(16).padStart(64,'0').toLowerCase();
        return hexId === m_id || hexId === t_id;
      });
      
      if (isTarget) matchCount++;

      const amt = Number(BigInt('0x' + data.substring(128, 192))) / 1e6;
      if (!whaleTrade || amt > whaleTrade.amt) {
        whaleTrade = { amt, tx: log.transactionHash };
      }
    }

    return {
      txCount: matchCount.toString(),
      truthScore: existsOnchain ? (isResolved ? 100 : 70) : 20,
      onchainStatus: isResolved ? "Resolved" : (existsOnchain ? "Active" : "Unverified"),
      whaleRadar: whaleTrade ? `$${Math.round(whaleTrade.amt)} Whale Trade detected` : "Normal activity",
      isRawOnchain: true
    };
  } catch (err) {
    return null;
  }
}
