// 核心调度：处理来自各处的 API 请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleFetch = async (url) => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (!match) throw new Error("No valid JSON found");
      return JSON.parse(match[0]);
    } catch (error) {
      console.error("Fetch error:", error);
      throw error;
    }
  };

  if (request.type === 'FETCH_MARKETS') {
    handleFetch('https://gamma-api.polymarket.com/events?limit=5&active=true&closed=false')
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === 'SEARCH_SPECIFIC_MARKET') {
    const url = `https://gamma-api.polymarket.com/events?limit=1&active=true&closed=false&q=${encodeURIComponent(request.query)}`;
    
    handleFetch(url)
      .then(data => {
        const event = data[0];
        if (event && event.markets && event.markets.length > 0) {
          // 1. 过滤出真正活跃的市场
          const activeMarkets = event.markets.filter(m => m.active && !m.closed);
          
          if (activeMarkets.length === 0) {
            return sendResponse({ success: false });
          }

          // 2. 寻找最具代表性的市场
          // 如果是多个选项（Neg Risk），我们寻找概率最高的那个（代表共识）
          let bestMarket = activeMarkets[0];
          let maxPrice = 0;
          let bestOutcomeIndex = 0;

          activeMarkets.forEach(m => {
            const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            const outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes;
            
            // 找出这个市场中概率最高的选项
            prices.forEach((p, idx) => {
              const currentPrice = parseFloat(p);
              if (currentPrice > maxPrice) {
                maxPrice = currentPrice;
                bestMarket = m;
                bestOutcomeIndex = idx;
              }
            });
          });

          const outcomes = typeof bestMarket.outcomes === 'string' ? JSON.parse(bestMarket.outcomes) : bestMarket.outcomes;
          const outcomeName = outcomes[bestOutcomeIndex];

          // 3. 构造更具体的题目
          // 如果结果是 Yes/No，保持原题；如果是具体选项（如人数范围），把选项加到题目里
          let displayTitle = bestMarket.question || event.title;
          if (outcomeName && !["Yes", "No"].includes(outcomeName)) {
            displayTitle = `${displayTitle} (${outcomeName})`;
          }

          sendResponse({ 
            success: true, 
            title: displayTitle,
            price: (maxPrice * 100).toFixed(0),
            slug: event.slug,
            volume: Math.round(event.volumeNum || bestMarket.volumeNum || 0)
          });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch(err => {
        console.error("Search Error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});
