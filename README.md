# PolySearch 🔍

**Turn every Google search into a prediction opportunity.**  
PolySearch is a Chrome extension that bridges search intent with Polymarket’s prediction reality.

---

## 🌍 Project Overview

### 📌 Background
Major real-world events — elections, macroeconomic data, tech trends, and sports — drive massive search activity on Google.  
At the same time, prediction markets like **Polymarket** transform these events into collective probability signals and market-driven forecasts.

However, these two worlds remain largely disconnected.  
When users search for an event, they often **don’t know whether a corresponding prediction market already exists**, nor how the market is pricing the outcome.

---

### ❗ Problem
> There is no direct bridge between search intent and prediction markets, making it difficult for high-intent users to discover relevant prediction opportunities.

---

### 💡 Solution
**PolySearch** is a lightweight Chrome extension that acts as a logical bridge between Google Search and prediction markets.

When a user searches for a real-world event on Google, PolySearch:
- Detects the user’s search intent
- Matches the query against active Polymarket markets
- Surfaces a non-intrusive prompt directly on the search results page
- Allows one-click navigation to the corresponding Polymarket market

The extension does not modify search results, does not force redirects, and can be fully dismissed by the user.

> 📸 *Insert demo GIF here showing the in-page prompt*

---

## ⭐ Key Features

### ⚡ Client-side Only
PolySearch runs entirely in the browser using client-side JavaScript:
- No external servers required
- Search queries are never sent to third-party backends
- Near-instant response times
- Ideal for rapid MVP validation in a hackathon setting

---

### 🔌 Direct Polymarket Gamma API Integration
PolySearch directly consumes publicly available market metadata via the **Polymarket Gamma API**:
- Matches Google search queries with active prediction markets
- Reads market data only — no account access or trading actions

> *Note: PolySearch only reads publicly available market metadata and does not perform any trading actions on behalf of users.*

---

### 🪟 Non-intrusive Glassmorphism UI
- Modern glassmorphism-inspired design
- UI injected using **Shadow DOM** to avoid CSS conflicts
- Does not disrupt or reflow Google’s search results layout

---

### 🚀 One-click Market Navigation
When a relevant market is found, users can jump directly from Google Search to the corresponding Polymarket market page with a single click.

---

## 🧱 Technical Architecture

PolySearch follows a simple and robust front-end architecture:

### 🧩 Core
- Chrome **Manifest V3**
- Vanilla JavaScript (ES6+)
- No heavy frameworks or backend services

---

### 🧬 Page Injection
- Uses **Content Scripts** to monitor URL changes on Google Search (SPA-compatible)
- Injects UI via **Shadow DOM** for style isolation

---

### 🔄 Data Flow
- Uses `fetch` to directly call the Polymarket Gamma API
- No server-side processing or API proxying

---

### 🎯 Matching Logic
- Client-side keyword normalization and filtering
- Confidence thresholds to ensure prompts appear only for highly relevant queries

**High-level flow:**
```text
Google Search Query
        ↓
Client-side Matching Logic
        ↓
Prediction Market Prompt → One-click Redirect
