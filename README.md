# 🏛️ Equis — RWA 2.0 Margin Credit & Yield Protocol for Tokenized Stocks on X Layer

> Built for **OKX Dev Day 2026** (Live Finale Target in Singapore — Oct 6, 2026 SGT)  
> **Primary Track:** `X Layer: Tokenized stocks and RWA`  
> **Ecosystem:** X Layer (Chain 196) + 40+ Tokenized Stocks + EIP-7702 Session Keys + OKX Agentic Wallet  
> **License:** Apache 2.0 Open Source  

---

## 📌 Overview

**Equis** is an institutional RWA 2.0 credit, borrowing, and yield protocol built specifically for the 40+ tokenized stocks (e.g., NVDA, AAPL, TSLA) and ETFs on X Layer (Chain 196).

- **Tokenized Stock Collateral Vaults:** Users deposit tokenized shares of NVDA, AAPL, or TSLA to borrow instant liquid USDT/OKB on X Layer without selling their equity positions.
- **EIP-7702 & OKX Agentic Autopilot:** Leverages EIP-7702 session keys and OKX Agentic Wallet automation for background collateral rebalancing and 1-click liquidation protection.
- **Automated RWA Yield Routing:** Routes borrowed capital directly into X Layer's $5M RWA Ecological Liquidity Pools to earn real APY.

---

## 🚀 Quickstart & Setup Instructions

### 1. Prerequisites
- Node.js 18+
- [Foundry](https://getfoundry.sh)
- X Layer EVM Wallet (OKX Agentic Wallet / MetaMask)

### 2. Installation
```bash
git clone --recurse-submodules https://github.com/mrnetwork/Equis.git
cd Equis
npm install
npm run dev              # Web dashboard + Telegram Mini App → http://localhost:3000
npm run contracts:test   # Foundry test suite
```

### 3. Repository Layout
```
src/app/     Next.js 14 App Router — Web3 dashboard + Telegram Mini App
contracts/   Foundry project — X Layer Margin Vault (Solidity)
```

---

## 📄 License
Apache 2.0 Open Source
