// 核心语义匹配引擎：基于 BM25 排序算法

/**
 * 文本分词与标准化
 */
function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 0);
}

/**
 * 计算词频
 */
function getTermFrequency(tokens) {
  const tf = {};
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  return tf;
}

/**
 * BM25 评分算法
 * @param {string} query - 查询文本
 * @param {string} document - 文档文本
 * @param {Object} corpusStats - 语料库统计信息 { avgDocLength, idf }
 * @param {number} k1 - 词频饱和参数 (default: 1.5)
 * @param {number} b - 长度归一化参数 (default: 0.75)
 * @param {boolean} debug - 是否打印调试信息
 */
export function calculateBM25(query, document, corpusStats = {}, k1 = 1.5, b = 0.75, debug = false) {
  if (!query || !document) return 0;

  const queryTokens = tokenize(query);
  const docTokens = tokenize(document);
  const docTF = getTermFrequency(docTokens);
  const docLength = docTokens.length;
  const avgDocLength = corpusStats.avgDocLength || 10;
  const idf = corpusStats.idf || {};

  let totalScore = 0;
  const matchDetails = [];

  queryTokens.forEach(term => {
    const termFreq = docTF[term] || 0;
    const termIDF = idf[term] || 0;

    if (termFreq > 0) {
      // BM25 核心公式
      const numerator = termFreq * (k1 + 1);
      const denominator = termFreq + k1 * (1 - b + b * (docLength / avgDocLength));
      const termScore = termIDF * (numerator / denominator);
      
      totalScore += termScore;
      matchDetails.push({ term, tf: termFreq, idf: termIDF.toFixed(3), score: termScore.toFixed(4) });
    }
  });

  // [DEBUG] 打印 BM25 计算详情
  if (debug) {
    console.log(`%c [BM25] Query: "${query}"`, "color: #8b5cf6; font-weight: bold;");
    console.log(`%c [BM25] Document: "${document}"`, "color: #8b5cf6;");
    console.log(`  → Query Tokens:`, queryTokens);
    console.log(`  → Doc Tokens:`, docTokens);
    console.log(`  → Doc Length: ${docLength} | Avg: ${avgDocLength.toFixed(1)}`);
    console.log(`  → Match Details:`, matchDetails);
    console.log(`  → BM25 Score: ${totalScore.toFixed(4)}`);
  }

  return totalScore;
}

/**
 * 高级匹配：BM25 + 精确匹配加权
 */
export function getSemanticScore(title, query, corpusStats = {}, debug = false) {
  if (!title || !query) return 0;

  // 1. BM25 基础分
  let score = calculateBM25(query, title, corpusStats, 1.5, 0.75, debug);

  // 2. 精确匹配加权（针对短词和专有名词）
  const coreKeywords = ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'trump', 'elon', 'musk', 'doge', 'nvidia'];
  const qTokens = tokenize(query);
  const docTokens = tokenize(title);
  
  let exactBoost = 0;
  qTokens.forEach(qToken => {
    // 精确匹配核心词，大幅加分
    if (coreKeywords.includes(qToken) && docTokens.includes(qToken)) {
      exactBoost += 5.0;
    }
    // 精确词匹配（query 词完整出现在 doc 中）：强信号，+5（如 lululemon、apple）
    else if (docTokens.includes(qToken)) {
      exactBoost += 5.0;
    }
    // 子串匹配加分（处理 "btc" 匹配 "bitcoin" 的情况）
    else if (docTokens.some(dToken => dToken.includes(qToken) || qToken.includes(dToken))) {
      exactBoost += 1.0;
    }
  });

  score += exactBoost;

  if (debug && exactBoost > 0) {
    console.log(`  → Exact Match Boost: +${exactBoost.toFixed(2)} | Final Score: ${score.toFixed(4)}`);
  }

  return score;
}

/**
 * 倒排索引管理类：用于快速召回候选集 + BM25 统计
 */
export class MarketIndex {
  constructor() {
    this.index = new Map(); // keyword -> Set of market indices
    this.markets = [];
    this.stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'will', 'be', 'to', 'for', 'of', 'in', 'and']);
    this.corpusStats = { avgDocLength: 10, idf: {} }; // BM25 统计信息
  }

  /**
   * 构建/更新倒排索引 + 计算 BM25 统计
   */
  update(markets) {
    if (!Array.isArray(markets)) return;
    this.index.clear();
    this.markets = markets;
    
    const documentFreq = {}; // 每个词出现在多少个文档中
    let totalDocLength = 0;

    // 第一遍：构建倒排索引 + 统计 DF
    markets.forEach((m, idx) => {
      const text = `${m.question || ''} ${m.title || ''} ${m.choice || ''}`.toLowerCase();
      const tokens = text.split(/[^a-z0-9]+/).filter(t => t.length > 0 && !this.stopWords.has(t));
      totalDocLength += tokens.length;

      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(token => {
        // 更新倒排索引
        if (!this.index.has(token)) {
          this.index.set(token, new Set());
        }
        this.index.get(token).add(idx);

        // 统计文档频率
        documentFreq[token] = (documentFreq[token] || 0) + 1;
      });
    });

    // 第二遍：计算 IDF (Inverse Document Frequency)
    const N = markets.length;
    this.corpusStats.avgDocLength = totalDocLength / Math.max(N, 1);
    this.corpusStats.idf = {};

    Object.keys(documentFreq).forEach(term => {
      const df = documentFreq[term];
      // IDF 公式：ln((N - df + 0.5) / (df + 0.5) + 1)
      this.corpusStats.idf[term] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    });

    console.log(`%c [Index] 索引构建完成`, "color: #10b981; font-weight: bold;");
    console.log(`  → 市场数: ${this.markets.length}`);
    console.log(`  → 关键词数: ${this.index.size}`);
    console.log(`  → 平均文档长度: ${this.corpusStats.avgDocLength.toFixed(1)} 词`);
    console.log(`  → IDF 样本 (前5):`, Object.entries(this.corpusStats.idf).slice(0, 5).map(([k, v]) => `${k}=${v.toFixed(2)}`));
  }

  /**
   * 获取 BM25 统计信息（供打分函数使用）
   */
  getCorpusStats() {
    return this.corpusStats;
  }

  /**
   * 搜索候选集：根据查询词快速召回相关市场
   */
  search(query) {
    if (!query || this.markets.length === 0) return [];
    
    const qTokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 0 && !this.stopWords.has(t));
    if (qTokens.length === 0) return [];

    const candidateIndices = new Set();
    qTokens.forEach(token => {
      // 1. 精确匹配索引
      if (this.index.has(token)) {
        this.index.get(token).forEach(idx => candidateIndices.add(idx));
      }
      
      // 2. 模糊匹配 (处理单复数或前缀)
      for (const [key, indices] of this.index.entries()) {
        if (key !== token && (key.startsWith(token) || token.startsWith(key))) {
          indices.forEach(idx => candidateIndices.add(idx));
        }
      }
    });

    return Array.from(candidateIndices).map(idx => this.markets[idx]);
  }
}
