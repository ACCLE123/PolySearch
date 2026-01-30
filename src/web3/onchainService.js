// 链上数据服务：直接从 Polygon RPC 节点解析原始 Event Logs
// 绕过不稳定的中心化 Data API，提供 100% 去中心化证明

const POLYGON_RPC_NODES = [
  "https://1rpc.io/matic",
  "https://polygon-rpc.com",
  "https://rpc.ankr.com/polygon",
  "https://polygon.llamarpc.com",
  "https://rpc-mainnet.maticvigil.com"
];
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const ORDER_FILLED_TOPIC0 = "0x63bf4d16b7fa898ef4c4b2b6d90fd201e9c56313b65638af6088d149d2ce956c";
const CLOB_EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEG_RISK_EXCHANGE_ADDRESS = "0xC5d563A36AE78145C45a50134d48A1215220f80a";

const parseHex = (hex) => (hex || "").startsWith('0x') ? hex.slice(2) : hex;

const callRPC = async (method, rpcParams) => {
  let lastError = "";
  for (const url of POLYGON_RPC_NODES) {
    try {
      console.log(`[Web3 RPC] 尝试节点: ${url} -> ${method}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ jsonrpc: "2.0", method, params: rpcParams, id: Date.now() }),
        signal: AbortSignal.timeout(6000) // 稍长一点的超时
      });
      
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }

      const json = await response.json();
      if (json && json.result !== undefined) return json;
      if (json && json.error) {
        lastError = json.error.message;
        console.warn(`[Web3 RPC] 节点 ${url} 业务报错:`, lastError);
      }
    } catch (e) {
      lastError = e.name === 'TimeoutError' ? 'Timeout' : e.message;
      console.warn(`[Web3 RPC] 节点 ${url} 连接异常:`, lastError);
    }
  }
  return { error: `All nodes failed. Last error: ${lastError}` };
};

function formatVolume(usd) {
  if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(1) + 'M';
  if (usd >= 1e3) return '$' + (usd / 1e3).toFixed(1) + 'k';
  return '$' + Math.round(usd);
}

/**
 * 链上嗅探：发现最近 100 个区块内最活跃的 Token IDs (全平台)
 * @returns {Promise<string[]>} 十进制 Token ID 数组
 */
export async function discoverLiveHotTokens() {
  try {
    const blockData = await callRPC("eth_blockNumber", []);
    const latest = parseInt(blockData?.result || "0x0", 16);
    if (!latest || latest < 1000) return [];

    // 扩大范围到 100 块 (约 3.5 分钟)，提高捕获概率
    // 避开可能尚未索引的最新 50 个块，往前扫 100 个已确认稳定的块
    const fromBlockNum = Math.max(0, latest - 150);
    const toBlockNum = Math.max(0, latest - 50);
    const fromBlock = '0x' + fromBlockNum.toString(16);
    const toBlock = '0x' + toBlockNum.toString(16);

    console.log(`%c [Web3 Sniff] 诊断模式：扫描稳定区块 (${fromBlockNum} -> ${toBlockNum})...`, "color: #f59e0b;");

    // 扫描标准交易所
    const res = await callRPC("eth_getLogs", [{ 
      fromBlock, 
      toBlock, 
      address: CLOB_EXCHANGE_ADDRESS, 
      topics: [ORDER_FILLED_TOPIC0] 
    }]);

    if (res.error) {
      console.error("[Web3 Sniff] RPC 返回错误:", res.error);
      return [];
    }

    const logs = res.result || [];
    console.log(`%c [Web3 Sniff] 稳定块成交提取结果: ${logs.length} 条`, logs.length > 0 ? "color: #10b981;" : "color: #ef4444;");
    
    if (logs.length === 0) {
      // 最终尝试：不带 address 过滤
      const fallbackRes = await callRPC("eth_getLogs", [{ fromBlock, toBlock, topics: [ORDER_FILLED_TOPIC0] }]);
      return processLogs(fallbackRes.result || []);
    }

    return processLogs(logs);

    function processLogs(targetLogs) {
      const counts = {};
      targetLogs.forEach(log => {
        const data = parseHex(log.data);
        if (data.length < 128) return;
        [data.substring(0, 64), data.substring(64, 128)].forEach(id => {
          const cleanId = id.toLowerCase();
          // 过滤掉 USDC 等常见抵押品 ID (通常含有大量 0)
          if (cleanId.includes('00000000000000000000000000000000')) return;
          counts[cleanId] = (counts[cleanId] || 0) + 1;
        });
      });
      // 返回前 200 个最活跃的 Token，以便后续筛选出 50-100 个有效市场
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 200)
        .map(entry => BigInt('0x' + entry[0]).toString());
    }
  } catch (e) {
    return [];
  }
}

/**
 * 获取市场链上指标
 */
export async function getOnchainMetrics(params) {
  const { conditionId, clobTokenIds, isNegRisk } = params;
  if (!clobTokenIds || !Array.isArray(clobTokenIds)) return null;

  try {
    const blockData = await callRPC("eth_blockNumber", []);
    const latest = parseInt(blockData?.result || "0x0", 16);
    if (!latest) throw new Error("RPC 节点响应异常");

    // 状态查询
    const getCtfState = async (fnSelector, cid) => {
      if (!cid || !cid.startsWith('0x')) return "0x0";
      const data = '0x' + fnSelector.replace('0x','') + cid.replace('0x','').padStart(64, '0');
      try {
        const res = await callRPC("eth_call", [{ to: CTF_CONTRACT, data }, "latest"]);
        return res.result && res.result !== '0x' ? res.result : "0x0";
      } catch { return "0x0"; }
    };

    const [slotCountHex, denominatorHex] = await Promise.all([
      getCtfState("0x56086f6f", conditionId),
      getCtfState("0x90297274", conditionId)
    ]);

    const slotCount = parseInt(slotCountHex, 16);
    const isResolved = BigInt(denominatorHex) > 0n;
    const existsOnchain = slotCount > 0;

    // 扩大范围到 100 块 (约 3.5 分钟)，提高捕获概率
    // 避开可能尚未索引的最新 50 个块，往前扫 100 个已确认稳定的块
    const fromBlockNum = Math.max(0, latest - 150);
    const toBlockNum = Math.max(0, latest - 50);
    const fromBlock = '0x' + fromBlockNum.toString(16);
    const toBlock = '0x' + toBlockNum.toString(16);

    const radarRes = await callRPC("eth_getLogs", [{ 
      fromBlock, 
      toBlock, 
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
      
      const isTarget = clobTokenIds.some(id => 
        BigInt(id).toString(16).padStart(64,'0').toLowerCase() === m_id || 
        BigInt(id).toString(16).padStart(64,'0').toLowerCase() === t_id
      );
      
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
      whaleRadar: whaleTrade ? `$${Math.round(whaleTrade.amt)} Whale Trade detected globally (3.5m)` : "Market activity is normal",
      isRawOnchain: true
    };
  } catch (err) {
    return null;
  }
}
