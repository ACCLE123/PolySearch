// 核心语义匹配引擎：基于 N-Gram 向量相似度算法

/**
 * 将文本向量化为 3-Gram 计数对象
 */
export function getNGramVector(text) {
  const n = 3;
  const vector = {};
  const words = (text || "").toLowerCase().split(/[\s,.-]+/);
  
  words.forEach(word => {
    if (word.length < n) {
      if (word.length > 0) vector[word] = (vector[word] || 0) + 1;
      return;
    }
    for (let i = 0; i <= word.length - n; i++) {
      const gram = word.substring(i, i + n);
      vector[gram] = (vector[gram] || 0) + 1;
    }
  });
  return vector;
}

/**
 * 计算两个向量之间的余弦相似度
 */
export function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  
  keys.forEach(key => {
    const valA = vecA[key] || 0;
    const valB = vecB[key] || 0;
    dotProduct += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  });
  
  return magA && magB ? dotProduct / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

/**
 * 计算查询词与目标文本的语义关联分
 */
export function getSemanticScore(title, query) {
  if (!title || !query) return 0;
  const titleVec = getNGramVector(title);
  const queryVec = getNGramVector(query);
  let score = cosineSimilarity(titleVec, queryVec);

  // 核心词硬匹配增益 (针对币种名等高频核心词)
  const coreKeywords = ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'trump'];
  const qWords = query.toLowerCase().split(/\s+/);
  const tWords = title.toLowerCase().split(/\s+/);
  
  qWords.forEach(qw => {
    if (coreKeywords.includes(qw) && tWords.some(tw => tw.includes(qw) || qw.includes(tw))) {
      score += 0.2; 
    }
  });

  return score;
}
