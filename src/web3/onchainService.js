// 链上数据服务：直接从 Polygon RPC 节点解析原始 Event Logs

const POLYGON_RPC_NODES = [
  "https://polygon-rpc.com",
  "https://polygon.llamarpc.com",
  "https://rpc.ankr.com/polygon",
  "https://polygon-bor-rpc.publicnode.com",
  "https://1rpc.io/matic"
];

const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const ORDER_FILLED_TOPIC0 = "0x63bf4d16b7fa898ef4c4b2b6d90fd201e9c56313b65638af6088d149d2ce956c";
const CLOB_EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// 进一步优化窗口：200 块约 6 分钟，更适合公共节点
const SCAN_WINDOW = 200;
const STABLE_OFFSET = 0;

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
        signal: AbortSignal.timeout(10000)
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
    if (res.error) {
      console.warn(`%c [RPC Error] eth_getLogs 失败: ${res.error}`, "color: #ef4444;");
    }
    console.log(`%c [On-chain] 探测到 ${logs.length} 条原始成交记录 (Range: ${parseInt(range.from,16)} - ${parseInt(range.to,16)})`, "color: #3b82f6; font-weight: bold;");
    
    if (logs.length === 0) return [];

    const counts = {};
    const volumes = {}; // 累计成交额
    
    logs.forEach(log => {
      const data = parseHex(log.data);
      const dataBytes = data.length / 2;
      if (dataBytes < 128) return;

      let m_id_hex, t_id_hex, m_amt_raw, t_amt_raw;

      if (dataBytes >= 160) {
        // 包含 taker 地址的情况: [taker(32), m_id(32), t_id(32), m_amt(32), t_amt(32)]
        m_id_hex = data.substring(64, 128);
        t_id_hex = data.substring(128, 192);
        m_amt_raw = data.substring(192, 256);
        t_amt_raw = data.substring(256, 320);
      } else {
        // 不包含 taker 地址的情况: [m_id(32), t_id(32), m_amt(32), t_amt(32)]
        m_id_hex = data.substring(0, 64);
        t_id_hex = data.substring(64, 128);
        m_amt_raw = data.substring(128, 192);
        t_amt_raw = data.substring(192, 256);
      }
      
      const m_id = BigInt('0x' + m_id_hex);
      const t_id = BigInt('0x' + t_id_hex);
      const m_amt = Number(BigInt('0x' + m_amt_raw));
      const t_amt = Number(BigInt('0x' + t_amt_raw));

      // 确定 USDC 成交额 (AssetID 0 通常是 USDC)
      let usdAmount = 0;
      let tokenIdHex = "";
      
      if (m_id === 0n) {
        usdAmount = m_amt / 1e6;
        tokenIdHex = t_id_hex.toLowerCase();
      } else if (t_id === 0n) {
        usdAmount = t_amt / 1e6;
        tokenIdHex = m_id_hex.toLowerCase();
      } else {
        // 兜底逻辑：哪个 ID 长（大）哪个就是 Token
        if (m_id > t_id) {
          tokenIdHex = m_id_hex.toLowerCase();
          usdAmount = t_amt / 1e6;
        } else {
          tokenIdHex = t_id_hex.toLowerCase();
          usdAmount = m_amt / 1e6;
        }
      }

      if (tokenIdHex) {
        counts[tokenIdHex] = (counts[tokenIdHex] || 0) + 1;
        volumes[tokenIdHex] = (volumes[tokenIdHex] || 0) + usdAmount;
      }
    });

    const sortedTokens = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 200);

    // 仅保留基础统计输出，不再请求 API 打印市场标题
    console.log(`%c [On-chain] 嗅探完成: 发现 ${sortedTokens.length} 个活跃 Token`, "color: #10b981; font-weight: bold;");

    return sortedTokens.map(entry => BigInt('0x' + entry[0]).toString());
  } catch (e) {
    return [];
  }
}

/**
 * 获取具体市场的链上核心指标
 */
export async function getOnchainMetrics(params) {
  const { conditionId, clobTokenIds } = params;
  console.log(`%c [On-chain] 深度扫描启动: ${conditionId} | Tokens: ${clobTokenIds?.length || 0}`, "color: #f59e0b; font-weight: bold;");
  
  if (!clobTokenIds || !Array.isArray(clobTokenIds)) {
    console.warn("   ⚠️ 无效的 clobTokenIds，停止扫描");
    return null;
  }

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
    console.log(`%c [On-chain] 深度扫描匹配: 发现 ${allLogs.length} 条相关 L2 交易`, "color: #8b5cf6;");
    let matchCount = 0;
    let whaleTrade = null;

    for (const log of allLogs) {
      const data = parseHex(log.data);
      const dataBytes = data.length / 2;
      if (dataBytes < 128) continue;

      let m_id_hex, t_id_hex, m_amt_raw, t_amt_raw;

      if (dataBytes >= 160) {
        // [taker, m_id, t_id, m_amt, t_amt]
        m_id_hex = data.substring(64, 128);
        t_id_hex = data.substring(128, 192);
        m_amt_raw = data.substring(192, 256);
        t_amt_raw = data.substring(256, 320);
      } else {
        // [m_id, t_id, m_amt, t_amt]
        m_id_hex = data.substring(0, 64);
        t_id_hex = data.substring(64, 128);
        m_amt_raw = data.substring(128, 192);
        t_amt_raw = data.substring(192, 256);
      }
      
      const m_id = BigInt('0x' + m_id_hex);
      const t_id = BigInt('0x' + t_id_hex);
      const m_amt = BigInt('0x' + m_amt_raw);
      const t_amt = BigInt('0x' + t_amt_raw);
      
      const isTarget = clobTokenIds.some(id => {
        const hexId = BigInt(id).toString(16).padStart(64,'0').toLowerCase();
        return hexId === m_id_hex.toLowerCase() || hexId === t_id_hex.toLowerCase();
      });
      
      if (isTarget) {
        matchCount++;
        
        let side = "UNKNOWN";
        let price = 0;
        let usdAmount = 0;

        if (m_id === 0n && t_amt > 0n) {
          side = "BUY";
          price = Number(m_amt) / Number(t_amt);
          usdAmount = Number(m_amt) / 1e6;
        } else if (t_id === 0n && m_amt > 0n) {
          side = "SELL";
          price = Number(t_amt) / Number(m_amt);
          usdAmount = Number(t_amt) / 1e6;
        }

        console.log(`%c [TRADE] ${side.padEnd(4)} | 价格: ${price.toFixed(4)} | 金额: $${Math.round(usdAmount).toString().padEnd(6)} | Tx: ${log.transactionHash.slice(0,12)}...`, "color: #10b981; font-weight: bold;");
        
        console.dir({
          txHash: log.transactionHash,
          side: side,
          price: price.toFixed(6),
          amountUSDC: usdAmount.toFixed(2),
          tokenId: (m_id === 0n ? t_id_hex : m_id_hex).toLowerCase(),
          makerAssetId: m_id.toString(),
          takerAssetId: t_id.toString()
        });
      }

      const amt = Math.max(Number(m_amt), Number(t_amt)) / 1e6;
      if (!whaleTrade || amt > whaleTrade.amt) {
        whaleTrade = { amt, tx: log.transactionHash };
      }
    }

    return {
      txCount: matchCount.toString(),
      matchCount: matchCount, // 保存数字用于逻辑判断
      truthScore: existsOnchain ? (isResolved ? 100 : 70) : 20,
      onchainStatus: isResolved ? "Resolved" : (existsOnchain ? "Active" : "Unverified"),
      whaleRadar: whaleTrade ? `$${Math.round(whaleTrade.amt)} Whale Trade detected` : "Normal activity",
      isRawOnchain: true
    };
  } catch (err) {
    return null;
  }
}
