# PolySearch 🔍

## 项目简介
PolySearch 是一款基于 Google 搜索的 Polymarket 预测市场智能助手，能够在用户搜索时自动识别并展示相关的预测市场概率。

## 技术架构
- **前端注入**: 使用 Shadow DOM 实现与原网页隔离的毛玻璃 UI (Glassmorphism)。
- **匹配引擎**: 结合 BM25 算法与倒排索引，实现毫秒级的市场匹配。
- **数据层**: 
  - **Gamma API**: 用于获取 Polymarket 市场的元数据和搜索。
  - **Web3 服务**: 通过 Polygon RPC 节点直接监听链上 `OrderFilled` 事件，分析实时交易量与趋势。
- **架构设计**: 采用 Chrome Extension Manifest V3 标准，将复杂计算与数据刷新逻辑置于 Background Service Worker。

## 快速开始

### 环境要求
- 有效的 Polygon RPC URL (项目已内置 1rpc, llamarpc 等公共节点)
- 现代浏览器 (Chrome / Edge / Brave)

### 安装步骤
1. 克隆仓库: `git clone <repository-url>`
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启右上角的 **"开发者模式" (Developer mode)**
4. 点击 **"加载已解压的扩展程序" (Load unpacked)**，选择本项目文件夹

### 运行命令
本项目为原生 JavaScript 开发，无需构建步骤。
- 若需调试，请在扩展程序页面点击背景页 (service worker) 查看控制台。

## 功能说明
- **智能关联**: 在 Google 搜索页自动弹出相关的预测市场卡片。
- **实时概率**: 快速展示当前市场的 Odds (胜率)。
- **链上洞察**: 自动探测近期是否有大额鲸鱼交易 (Whale Trade)。
- **交互动画**: 支持数字滚动与滚动自动收纳功能。

## 数据来源
- **Polymarket Gamma API**: 提供市场列表、描述及图标。
- **Polygon 网络**: 通过 `eth_getLogs` 接口从 Polymarket 智能合约获取原始成交记录，分析交易频次与资金流向。

## 团队成员
- Polymarket Plugin Dev Team
