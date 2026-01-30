// 负责所有与 Polymarket API 相关的交互
export const PolymarketAPI = {
  async fetchTopMarkets(limit = 5) {
    try {
      const response = await fetch(`https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false`);
      const text = await response.text();
      // 使用强力正则提取 JSON
      const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (!match) throw new Error("No valid JSON found");
      return JSON.parse(match[0]);
    } catch (error) {
      console.error("Polymarket API Error:", error);
      throw error;
    }
  }
};
