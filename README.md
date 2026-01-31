# PolySearch 🔍

**Search-driven prediction market discovery for Polymarket**

A Chrome extension that automatically surfaces relevant Polymarket prediction markets when you search on Google.

---

## English Version

### Features
- **Smart Matching**: BM25 ranking + inverted index + API fallback for precise market discovery
- **Three-Tier Search**: Index recall → Global scan → Polymarket `public-search` API
- **On-Chain Sniffer**: Fetches hot markets from Polygon every 5 minutes via `OrderFilled` logs
- **Popup Hub**: Search markets, browse top 10 trending, live sniffer status
- **Google Integration**: Auto-injects a market card on search results when a relevant market exists
- **No-Result Feedback**: Toast message when no match is found (auto-dismisses in 4 seconds)
- **Privacy-First**: Processing runs locally in your browser

### How It Works
```
Google Search
    → Query Detection
    → BM25 Matching (Index ← hotMarkets ← On-chain Sniffer / Polygon RPC)
    → Global Scan (if index empty)
    → API Fallback (public-search)
    → Score ≥ 2.0?
        ├─ Yes → Market Card (Volume · Ends · Top Option · On-chain metrics)
        └─ No  → Toast: "No Polymarket market found for this search"

On-chain: 5-min sync → Live Volume & Trades (Polygon RPC)
```

### Installation
1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode**
4. Click **Load unpacked** → Select project folder

---

## 中文说明 (Chinese Version)

### 项目简介
PolySearch 是一款基于 Google 搜索的 Polymarket 预测市场智能助手，能够在用户搜索时自动识别并展示相关的预测市场概率。

### 技术架构
![项目架构图](image/structure.png)

- **前端注入**: 使用 Shadow DOM 实现与原网页隔离的毛玻璃 UI (Glassmorphism)。
- **匹配引擎**: 结合 BM25 算法与倒排索引，实现毫秒级的市场匹配。
- **数据层**: 
  - **Gamma API**: 用于获取 Polymarket 市场的元数据和搜索。
  - **Web3 服务**: 通过 Polygon RPC 节点直接监听链上 `OrderFilled` 事件，分析实时交易量与趋势。
- **架构设计**: 采用 Chrome Extension Manifest V3 标准，将复杂计算与数据刷新逻辑置于 Background Service Worker。

### 快速开始
1. 克隆仓库: `git clone <repository-url>`
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的 **"开发者模式" (Developer mode)**
4. 点击 **"加载已解压的扩展程序" (Load unpacked)**，选择本项目文件夹

---

## 团队成员 (Team Members)
- Liam Yang
- Amy Wang
- Polymarket Plugin Dev Team
