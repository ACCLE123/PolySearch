// 负责搜索词的匹配逻辑
export const Matcher = {
  keywords: [
    "election", "bitcoin", "trump", "fed", "interest rate", "crypto", "harris", 
    "world cup", "super bowl", "oscar", "ai", "nvidia", "tesla", "gpt"
  ],

  checkMatch(query) {
    if (!query) return null;
    const lowercaseQuery = query.toLowerCase();
    return this.keywords.find(keyword => lowercaseQuery.includes(keyword));
  }
};
