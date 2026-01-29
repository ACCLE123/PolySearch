chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'FETCH_MARKETS') {
    console.log("Background: Fetching from Gamma API...");
    
    fetch('https://gamma-api.polymarket.com/events?limit=5&active=true&closed=false', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.text();
    })
    .then(text => {
      console.log("Background: Raw response received, length:", text.length);
      
      // 更加鲁棒的 JSON 提取逻辑：只提取第一个 [ 或 { 及其对应结尾的内容
      const match = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (!match) throw new Error("No valid JSON structure found in response");
      
      const cleanJson = match[0];
      const data = JSON.parse(cleanJson);
      
      sendResponse({ success: true, data: data });
    })
    .catch(error => {
      console.error('Background Fetch Error:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // 保持异步
  }
});
