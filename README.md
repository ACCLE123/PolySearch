# PolySearch 🔍

**Turn every Google search into a prediction opportunity.**  
PolySearch is a Chrome extension that bridges search intent with Polymarket’s prediction reality.

---

## ⭐ Project Overview

### Background
Major real-world events — elections, macroeconomic data, tech trends, and sports — drive massive search activity on Google.  
At the same time, prediction markets like **Polymarket** convert these events into collective probability signals and market-driven forecasts.

However, these two worlds remain largely disconnected.  
When users search for an event, they often **don’t know whether a corresponding prediction market already exists**, nor how the market is pricing the outcome.

### Problem
> There is no direct bridge between search intent and prediction markets, making it difficult for high-intent users to discover relevant prediction opportunities.

### Solution
**PolySearch** is a lightweight Chrome extension that acts as a logical bridge between Google Search and prediction markets.

When a user searches for a real-world event on Google, PolySearch:
- Detects the user’s search intent  
- Matches the query against active Polymarket markets  
- Surfaces a non-intrusive prompt directly on the search results page  
- Allows one-click navigation to the corresponding Polymarket market  

The extension does not modify search results, does not force redirects, and can be fully dismissed by the user.

> 📸 *Insert demo GIF here*

---

## ⭐ Key Features

- **Client-side Only**  
  Runs entirely in the browser with no external backend. Search queries never leave the user’s device.

- **Direct Polymarket API Integration**  
  Fetches publicly available market metadata via the Polymarket Gamma API.  
  *Read-only — no trading actions are performed.*

- **Non-intrusive UI**  
  Lightweight glassmorphism-style prompt injected via Shadow DOM without affecting Google’s layout.

- **One-click Navigation**  
  Jump directly from Google Search to the relevant Polymarket market page.

---

## 🛠 Technical Architecture

- **Framework**  
  Chrome Manifest V3, Vanilla JavaScript (ES6+)

- **Injection**  
  Content Scripts monitor Google Search URL changes (SPA-compatible)  
  Shadow DOM isolates styles and prevents CSS conflicts

- **Data Flow**  
  Client-side `fetch` calls to the Polymarket Gamma API  
  No server-side processing or proxying

- **Matching Logic**  
  Keyword normalization and filtering with confidence thresholds  
  Prompts appear only for highly relevant queries

```text
Google Search Query
        ↓
Client-side Matching Logic
        ↓
Prediction Market Prompt → One-click Redirect
