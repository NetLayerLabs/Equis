# Equis

Margin credit against tokenized stocks on X Layer. Deposit tokenized shares of NVIDIA, Apple or Tesla as
collateral, borrow USD₮0 against them, and keep the shares: no sale, no taxable disposal, no lost upside.
An optional EIP-7702 session key lets an agent defend the position while you sleep, without ever being able
to withdraw or borrow.

Built for OKX Dev Day 2026, track "X Layer: tokenized stocks and RWA". Live on X Layer mainnet.

## Live on X Layer mainnet (chain 196)

Deployed 24 September 2026. Source is verified on Sourcify with an exact match on both creation and runtime
bytecode, so the code you read is the code that runs.

| Contract | Address | What it does |
| --- | --- | --- |
| EquisMarginVault | [`0x6577BFc845B9Bf56DAF38b0ff0b2dD248Ad4885F`](https://web3.okx.com/explorer/x-layer/evm/address/0x6577BFc845B9Bf56DAF38b0ff0b2dD248Ad4885F) | Holds collateral, enforces LTV, runs liquidations |
| EquisLendingPool | [`0xC6e2EFc3f92B9eE88ae66000cB1c66ee20F1fF8e`](https://web3.okx.com/explorer/x-layer/evm/address/0xC6e2EFc3f92B9eE88ae66000cB1c66ee20F1fF8e) | ERC-4626 pool of USD₮0 that lenders supply |
| RedStonePriceOracle | [`0x478A62bDD88A26d10c854F4E382fDE0573d16b4d`](https://web3.okx.com/explorer/x-layer/evm/address/0x478A62bDD88A26d10c854F4E382fDE0573d16b4d) | Verifies signed prices onchain |
| EquisSessionDelegate | [`0x946A509bC424367c7F6C3d0e534e037026c917eD`](https://web3.okx.com/explorer/x-layer/evm/address/0x946A509bC424367c7F6C3d0e534e037026c917eD) | EIP-7702 delegate for scoped agent keys |
| KinkedRateModel | [`0xf0d09B9e5444F24A33cEAe5Fe8DAa40411496Ed0`](https://web3.okx.com/explorer/x-layer/evm/address/0xf0d09B9e5444F24A33cEAe5Fe8DAa40411496Ed0) | Utilisation-based borrow rate |

Verified source: [vault](https://repo.sourcify.dev/196/0x6577BFc845B9Bf56DAF38b0ff0b2dD248Ad4885F),
[pool](https://repo.sourcify.dev/196/0xC6e2EFc3f92B9eE88ae66000cB1c66ee20F1fF8e),
[oracle](https://repo.sourcify.dev/196/0x478A62bDD88A26d10c854F4E382fDE0573d16b4d),
[delegate](https://repo.sourcify.dev/196/0x946A509bC424367c7F6C3d0e534e037026c917eD).

### Collateral listed at launch

Collateral is the **non-rebasing xStocks wrapper**, not the rebasing token: that is where X Layer's DEX
liquidity sits, which is what a liquidator has to sell into.

| Asset | Max LTV | Liquidation threshold | Bonus | Cap |
| --- | --- | --- | --- | --- |
| wNVDAx (NVIDIA) | 50% | 60% | 7.5% | $50k |
| wAAPLx (Apple) | 50% | 60% | 7.5% | $35k |
| wTSLAx (Tesla) | 40% | 50% | 10% | $35k |

Caps are roughly 8 to 9 percent of each wrapper's main X Layer DEX pool, so a fully liquidated position can
actually be sold. **wSPYx and wQQQx are deliberately not listed**: no public price feed exists for them, and
Equis does not lend against a price it cannot prove.

Pool: 250,000 USD₮0 supply cap, 10% reserve factor, 0% base rate rising to 8% APR at 80% utilisation and
108% APR at full utilisation.

## What is live, and what is not

**Live:** deposit and withdraw collateral, borrow and repay USD₮0, supply and withdraw as a lender,
liquidation, onchain price verification, EIP-7702 batching, a dashboard reading all of it from the chain, a
Telegram bot, and an MCP server that exposes the whole protocol to AI tools.

**Not built, on purpose:** the yield router described in the original project spec, and SPY/QQQ collateral
(no public price feed exists for them). Saying so beats overclaiming.

**The rule this codebase follows:** no mock data anywhere. Contracts are tested against forked mainnet state
with real tokens, and the interface shows a live reading or says it cannot get one. It never invents a number.

## How a borrow works

1. Your wallet fetches a signed RedStone price package from a public gateway. No API key is involved.
2. You call `borrow(amount, reports)` on the vault in **one transaction**, carrying that payload.
3. The vault relays the payload to the oracle, which verifies three of five known signatures onchain and
   caches the price.
4. The vault values your collateral, checks your borrow power, and the pool sends you USD₮0.

### Why the oracle calls itself

RedStone reads its payload from the calldata of the call *into the consumer*. A nested call from the vault
would drop it. So `updatePrices` re-enters the oracle with the payload appended, where the consumer can find
it. That keeps the price interface unchanged and, more importantly, keeps borrowing a **single transaction**
rather than depending on wallet batching support.

## The oracle

- **Stocks: RedStone.** Packages signed by three of five known signers, rejected once older than three
  minutes, on feeds that publish 24/5 so the overnight session still has prices.
- **A wrapper's price is the share price times its onchain multiplier**, read live from the wrapper. That
  multiplier grows as dividends are reinvested, so the valuation follows corporate actions instead of drifting.
- **USD₮0 and the sequencer: Chainlink push feeds**, which are free to read on X Layer. Every price read
  first checks the sequencer uptime feed and refuses to price anything during the grace period after a restart.
- Chainlink Data Streams is also implemented (`ChainlinkPriceOracle.sol`) behind the same interface. It costs
  $150 per stream per month, so RedStone is what is deployed. The vault does not care which one prices it.

## Risk model

- **Health factor** = collateral value weighted by liquidation thresholds, divided by debt. Below 1.0 the
  position can be liquidated; below 0.95 it can be closed in full rather than by the 50% close factor.
- **Market closed:** once a feed stops publishing, borrowing and withdrawing against that stock are blocked,
  while liquidations still clear at the last verified price.
- **Guardian** can pause borrowing without touching withdrawals. Ownership is `Ownable2Step`.
- **Lenders** cannot be trapped by a paused collateral token, and withdrawals are bounded by idle cash, not by
  an admin switch.
- Donations cannot move the pool's share price: cash is tracked internally and virtual shares blunt the
  first-depositor attack.

## EIP-7702 session keys

Your account points at `EquisSessionDelegate` and grants an agent a key that:

| May | May not |
| --- | --- |
| Call an explicit allowlist of functions, such as repay and top up collateral | Withdraw or borrow |
| Spend up to a cap per token, enforced by measuring balances before and after | Send native OKB |
| Act until an expiry you choose | Outlive revocation, which is immediate |

This is enforced in contract code, not in the interface. Vault actions take no recipient argument, so a key
cannot redirect funds even if it is allowlisted.

## Telegram

`@EquisBot` answers from the same chain reads as the dashboard, so the two cannot disagree.

| Command | Does |
| --- | --- |
| `/markets` | Live collateral prices, signed by RedStone |
| `/pool` | Supplied, borrowed, utilisation, supply and borrow APY |
| `/position <address>` | Collateral, debt, borrow power and health factor |
| `/watch <address>` | Messages you when that position's health factor falls below 1.15, and again when it recovers |

Run it with a token from @BotFather:

```bash
echo "TELEGRAM_BOT_TOKEN=..." >> .env.local
node scripts/telegram-bot.ts --check   # confirm the token
node scripts/telegram-bot.ts           # run it
```

Set `EQUIS_APP_URL` to an https address and the bot adds a button that opens the dashboard as a Telegram
Mini App. The interface already adapts to Telegram's viewport and theme.

## Use it from an AI tool

Equis ships an MCP server, so Claude Code, Claude Desktop, Cursor, Codex and anything else that speaks the
Model Context Protocol can read the protocol and prepare transactions against it. Clone the repo, run
`npm install`, and Claude Code picks up the `.mcp.json` in the root on its own. Everything else registers it
the same way:

```json
{
  "mcpServers": {
    "equis": { "command": "node", "args": ["scripts/mcp-server.ts"] }
  }
}
```

| Tool | Does |
| --- | --- |
| `equis_overview` | The deployment, the listed collateral and its risk parameters |
| `equis_markets` | Live prices, signed by RedStone |
| `equis_pool` | Supplied, borrowed, utilisation and both APYs |
| `equis_position` | Collateral, debt, borrow power and health factor for an address |
| `equis_quote_borrow` | What a given amount of collateral is worth and what it can borrow |
| `equis_build_transaction` | Unsigned `{ to, data, value }` for any action |

`equis_build_transaction` is the useful one. Ask for a borrow and it returns calldata with a **freshly signed
RedStone price already embedded**, so the transaction verifies its own price onchain and draws USD₮0 in a
single send. The payload is good for three minutes.

**The server holds no key and signs nothing.** It returns bytes; whatever you sign with stays outside this
process. That is the point: an agent can plan a position, quote it and hand you a transaction, while the
authority to move funds stays where you put it - in your wallet, or in an EIP-7702 session key scoped to
repay and top up collateral and nothing else.

Reads need no API key. The prices come from RedStone's public gateway.

## Quickstart

```bash
npm install
npm run dev                  # dashboard at http://localhost:3000, reading the live deployment

cd contracts
forge test                   # 35 tests against forked X Layer mainnet
```

Fetch a signed price payload and deploy your own instance:

```bash
node scripts/fetch-redstone-payload.ts
cd contracts
forge script script/DeployEquis.s.sol --rpc-url xlayer --account <your-keystore> --broadcast
```

Deployment costs about 0.0005 OKB. Owner, guardian and treasury default to the deployer; set `EQUIS_OWNER`
to a multisig for anything holding real money.

## Testing

35 tests pass against forked mainnet state, covering the pool's interest accrual and share accounting,
session key scoping and expiry, oracle verification of a **real signed payload** including a tampered payload
that must fail, and the Chainlink push feed path. One suite skips unless you supply a paid Chainlink Data
Streams fixture.

## Layout

```
src/                 Next.js 14 dashboard (App Router)
  app/app/           Overview, Markets, Earn, Agent keys
  lib/               chain config, ABIs, RedStone client
contracts/src/       Solidity: vault, pool, oracle, delegate, rate model
contracts/test/      Foundry fork tests against real mainnet state
contracts/script/    Deployment
scripts/             MCP server, Telegram bot, payload fetcher for tests and deployment
```

## Security and limitations

This is hackathon software. It is **unaudited**, the owner is currently an EOA rather than a multisig, and
the collateral caps are deliberately small. RedStone's consumer contracts are BUSL-1.1 and are referenced as
a git submodule rather than copied into this repository, which is Apache-2.0.

## Licence

Apache-2.0.
