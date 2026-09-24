/**
 * Equis as an MCP server: exposes the protocol to Claude Code, Claude Desktop, Cursor, Codex and any other
 * agent tool that speaks the Model Context Protocol.
 *
 *   node scripts/mcp-server.ts        (agent tools launch this themselves over stdio)
 *
 * Reads are free and need no keys. The build_* tools return unsigned calldata: this server never holds a
 * private key and never signs or sends anything. Whatever the agent uses to sign, including an EIP-7702
 * session key scoped to repay and top up collateral, stays outside this process.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { encodeFunctionData, isAddress, parseUnits, type Address } from "viem";
import { z } from "zod";
import { erc20Abi, lendingPoolAbi, marginVaultAbi } from "../src/lib/abis.ts";
import { OKX_ADDRESS_URL, USDT0, deployment } from "../src/lib/contracts.ts";
import { getMarketPrices, getPoolStats, getPosition } from "../src/lib/server/equisReads.ts";
import { buildRedStoneReport } from "../src/lib/server/redstonePayload.ts";
import { RISK_PARAMS } from "../src/lib/riskParams.ts";
import { LISTED_XSTOCKS, XSTOCKS } from "../src/lib/xstocks.ts";

const server = new McpServer({ name: "equis", version: "1.0.0" });

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

const addressArg = z.string().refine(isAddress, "must be a 0x address");
const symbolArg = z.enum(LISTED_XSTOCKS.map((s) => s.symbol) as [string, ...string[]]);

const wrapperFor = (symbol: string) =>
  (LISTED_XSTOCKS.find((s) => s.symbol.toLowerCase() === symbol.toLowerCase())?.wrapper ?? "") as Address;

server.registerTool(
  "equis_overview",
  {
    title: "Equis overview",
    description:
      "What Equis is, which contracts are deployed on X Layer mainnet, and which collateral is listed. Start here.",
    inputSchema: {},
  },
  async () =>
    text({
      what: "Margin credit against tokenized stocks on X Layer (chain 196): deposit tokenized shares, borrow USD₮0 without selling.",
      chainId: 196,
      contracts: {
        vault: deployment.vault,
        pool: deployment.pool,
        oracle: deployment.oracle,
        sessionDelegate: deployment.sessionDelegate,
      },
      explorer: `${OKX_ADDRESS_URL}${deployment.vault}`,
      debtAsset: { symbol: "USD₮0", address: USDT0, decimals: 6 },
      // Risk parameters are reported only for what is actually listed onchain. An unlisted asset has no
      // LTV to quote, and handing an agent one it could act on would be worse than saying nothing.
      collateral: XSTOCKS.map((stock) => ({
        symbol: stock.symbol,
        name: stock.name,
        address: stock.wrapper,
        decimals: 18,
        listed: Boolean(stock.redstoneFeed),
        ...(stock.redstoneFeed ? (RISK_PARAMS[stock.symbol] ?? {}) : {}),
        note: stock.redstoneFeed ? undefined : "not listed: no public price feed exists for it, so it cannot be deposited or borrowed against",
      })),
      pricing:
        "Stock prices are RedStone packages signed by 3 of 5 known signers and verified onchain in the same transaction that spends them. A wrapper is worth the share price times its onchain multiplier.",
    }),
);

server.registerTool(
  "equis_markets",
  {
    title: "Collateral prices",
    description: "Live price of each listed collateral wrapper, from signed RedStone data.",
    inputSchema: {},
  },
  async () => text(await getMarketPrices()),
);

server.registerTool(
  "equis_pool",
  {
    title: "Lending pool",
    description: "Supplied, borrowed, utilisation, supply and borrow APY, and what can be withdrawn right now.",
    inputSchema: {},
  },
  async () => text(await getPoolStats()),
);

server.registerTool(
  "equis_position",
  {
    title: "Position for an address",
    description:
      "Collateral, debt, borrow power and health factor. Health below 1.0 can be liquidated by anyone; below 0.95 the whole debt can be cleared at once.",
    inputSchema: { address: addressArg },
  },
  async ({ address }) => text(await getPosition(address as Address)),
);

server.registerTool(
  "equis_quote_borrow",
  {
    title: "How much could be borrowed",
    description: "Given a collateral asset and amount, returns its value and the USD₮0 borrowable against it.",
    inputSchema: { symbol: symbolArg, amount: z.number().positive() },
  },
  async ({ symbol, amount }) => {
    const prices = await getMarketPrices();
    const price = prices.find((entry) => entry.symbol.toLowerCase() === symbol.toLowerCase());
    if (!price?.priceUsd) return text(`No live price for ${symbol}.`);
    const params = RISK_PARAMS[price.symbol];
    const value = price.priceUsd * amount;
    return text({
      symbol: price.symbol,
      amount,
      priceUsd: price.priceUsd,
      collateralValueUsd: value,
      maxLtv: `${params.ltvBps / 100}%`,
      borrowableUsdt0: (value * params.ltvBps) / 10_000,
      liquidationThreshold: `${params.liquidationThresholdBps / 100}%`,
      warning: "Borrowing the maximum leaves no headroom: a small price fall makes the position liquidatable.",
    });
  },
);

server.registerTool(
  "equis_build_transaction",
  {
    title: "Build an unsigned transaction",
    description:
      "Returns { to, data, value } for deposit, withdraw, borrow, repay, supply or unsupply, ready for any wallet to sign. Borrow and withdraw automatically carry a freshly signed price. This server never signs or sends anything.",
    inputSchema: {
      action: z.enum(["approve_collateral", "deposit", "withdraw", "borrow", "repay", "supply", "unsupply"]),
      amount: z.number().positive(),
      symbol: symbolArg.optional().describe("Collateral symbol, for deposit, withdraw and approve_collateral"),
      account: addressArg
        .optional()
        .describe("Your address, for supply and unsupply; for repay, whose debt is being repaid"),
    },
  },
  async ({ action, amount, symbol, account }) => {
    const usdt0 = (value: number) => parseUnits(value.toString(), 6);
    const tokens = (value: number) => parseUnits(value.toString(), 18);

    if (["approve_collateral", "deposit", "withdraw"].includes(action) && !symbol) {
      return text("This action needs a collateral symbol.");
    }
    const wrapper = symbol ? wrapperFor(symbol) : undefined;

    switch (action) {
      case "approve_collateral":
        return text({
          to: wrapper,
          data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [deployment.vault, tokens(amount)] }),
          value: "0",
          note: "Approves exactly this amount, so no lingering allowance is left behind.",
        });
      case "deposit":
        return text({
          to: deployment.vault,
          data: encodeFunctionData({
            abi: marginVaultAbi,
            functionName: "depositCollateral",
            args: [wrapper as Address, tokens(amount)],
          }),
          value: "0",
          note: "Approve the vault first with approve_collateral.",
        });
      case "withdraw": {
        const { report, observedAt } = await buildRedStoneReport();
        return text({
          to: deployment.vault,
          data: encodeFunctionData({
            abi: marginVaultAbi,
            functionName: "withdrawCollateral",
            args: [wrapper as Address, tokens(amount), [report]],
          }),
          value: "0",
          priceObservedAt: observedAt,
          note: "Carries a signed price; send it within three minutes or rebuild it.",
        });
      }
      case "borrow": {
        const { report, observedAt } = await buildRedStoneReport();
        return text({
          to: deployment.vault,
          data: encodeFunctionData({
            abi: marginVaultAbi,
            functionName: "borrow",
            args: [usdt0(amount), [report]],
          }),
          value: "0",
          priceObservedAt: observedAt,
          note: "One transaction: it verifies the price and draws USD₮0. Send within three minutes.",
        });
      }
      case "repay":
        if (!account) return text("Repay needs the account whose debt is being repaid.");
        return text({
          to: deployment.vault,
          data: encodeFunctionData({
            abi: marginVaultAbi,
            functionName: "repay",
            args: [account as Address, usdt0(amount)],
          }),
          value: "0",
          note: `Approve the pool (${deployment.pool}) to spend USD₮0 first; the pool pulls the repayment.`,
        });
      case "supply":
        // Never guess the recipient: shares sent to the wrong address are not recoverable.
        if (!account) return text("Supplying needs your address, to receive the pool shares.");
        return text({
          to: deployment.pool,
          data: encodeFunctionData({
            abi: lendingPoolAbi,
            functionName: "deposit",
            args: [usdt0(amount), account as Address],
          }),
          value: "0",
          note: `Approve the pool (${deployment.pool}) to spend USD₮0 first. You earn what borrowers pay.`,
        });
      case "unsupply":
        if (!account) return text("Withdrawing supply needs your address.");
        return text({
          to: deployment.pool,
          data: encodeFunctionData({
            abi: lendingPoolAbi,
            functionName: "withdraw",
            args: [usdt0(amount), account as Address, account as Address],
          }),
          value: "0",
          note: "Bounded by the pool's idle cash; check equis_pool first.",
        });
    }
  },
);

await server.connect(new StdioServerTransport());
