# Equis Contracts

Foundry project for Equis on **X Layer mainnet** (chain 196, RPC `https://rpc.xlayer.tech`, alias `xlayer` in `foundry.toml`).

X Layer runs the **Prague** hardfork (EIP-7702 enabled) but not Osaka, so `evm_version` is pinned to `prague`.

## Contracts

| Contract                | Purpose                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `EquisMarginVault`      | Deposit xStocks wrappers (wNVDAx, wAAPLx, wTSLAx, wSPYx, wQQQx), borrow USD₮0, liquidations.     |
| `EquisLendingPool`      | ERC-4626 pool of USD₮0. Lenders earn the interest borrowers pay; only the vault can lend.        |
| `ChainlinkPriceOracle`  | Verifies Chainlink Data Streams v10 reports on-chain (price × multiplier); push feed for USD₮0.  |
| `KinkedRateModel`       | Utilization-based borrow rate with a kink.                                                      |
| `EquisSessionDelegate`  | EIP-7702 delegation target: scoped, expiring, spend-capped session keys for agents.             |

Collateral is the non-rebasing xStocks **wrappers**, not the rebasing tokens — that's where X Layer's DEX liquidity is.
While a stock's market is closed (Chainlink `marketStatus`), borrowing and withdrawing against it are blocked;
liquidations still run at the latest verified price.

## Usage

```shell
forge build
forge test -vvv   # tests fork live X Layer mainnet state — no mocks
forge fmt
```

### Real Chainlink reports for the vault tests

The xStocks Data Streams are entitlement-gated, so the vault tests replay reports fetched with your own key:

```shell
cp .env.example .env                     # fill in CHAINLINK_STREAMS_API_KEY / _SECRET
node ../scripts/fetch-stream-reports.ts  # writes test/fixtures/stream-reports.json (gitignored)
forge test --match-contract EquisMarginVaultTest -vv
```

### Deploy to X Layer mainnet

Set `EQUIS_OWNER`, `EQUIS_GUARDIAN` and `EQUIS_TREASURY` in `.env`, import the deployer key into an encrypted
keystore (`cast wallet import equis-deployer --interactive`), fund it with OKB for gas, then:

```shell
node ../scripts/fetch-stream-reports.ts   # the script refuses reports older than 90s
forge script script/DeployEquis.s.sol --rpc-url xlayer --account equis-deployer             # dry run
forge script script/DeployEquis.s.sol --rpc-url xlayer --account equis-deployer --broadcast # deploy
```

Collateral caps are defined in USD and converted at the live Chainlink price verified during deployment.
The owner must call `acceptOwnership()` on the pool, oracle and vault afterwards.

Without the reports file the vault tests are skipped. Fetch during US market hours to exercise borrowing; reports
captured while the market is closed skip the tests that need an open market.

Dependencies are git submodules (`lib/forge-std`, `lib/openzeppelin-contracts` v5.7.0). After a fresh clone:

```shell
git submodule update --init --recursive
```
