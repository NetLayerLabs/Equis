import { createPublicClient, formatUnits, http, type Address } from "viem";
import { xLayer } from "viem/chains";
import { erc4626Abi, lendingPoolAbi, marginVaultAbi } from "../abis.ts";
import { X_LAYER_RPC_URL, deployment } from "../contracts.ts";
import { REDSTONE_DATA_SERVICE_ID } from "../redstone.ts";
import { XSTOCKS } from "../xstocks.ts";

// Relative imports with extensions, so this runs under Next and under plain node (the Telegram bot).

/**
 * Chain reads shared by every server-side surface: the web app, the Telegram bot and any keeper.
 * One definition of what a position is, so the bot and the dashboard can never disagree.
 */
/** A server-only endpoint wins over the public one, so a keyed RPC never reaches the browser bundle. */
export const SERVER_RPC_URL = process.env.X_LAYER_RPC_URL?.trim() || X_LAYER_RPC_URL;

export const client = createPublicClient({ chain: xLayer, transport: http(SERVER_RPC_URL) });

const WAD = 10n ** 18n;
const GATEWAY = `https://oracle-gateway-1.a.redstone.finance/data-packages/latest/${REDSTONE_DATA_SERVICE_ID}`;

export type PoolStats = {
  supplied: number;
  borrowed: number;
  cash: number;
  supplyCap: number;
  utilisation: number;
  borrowApy: number;
  supplyApy: number;
};

export async function getPoolStats(): Promise<PoolStats> {
  const [supplied, borrowed, cash, supplyCap, reserveFactor, ratePerSecond] = await Promise.all([
    client.readContract({ address: deployment.pool, abi: lendingPoolAbi, functionName: "totalAssets" }),
    client.readContract({ address: deployment.pool, abi: lendingPoolAbi, functionName: "totalDebt" }),
    client.readContract({ address: deployment.pool, abi: lendingPoolAbi, functionName: "cash" }),
    client.readContract({ address: deployment.pool, abi: lendingPoolAbi, functionName: "supplyCap" }),
    client.readContract({ address: deployment.pool, abi: lendingPoolAbi, functionName: "reserveFactor" }),
    client.readContract({ address: deployment.pool, abi: lendingPoolAbi, functionName: "borrowRatePerSecond" }),
  ]);

  const utilisation = supplied > 0n ? Number(borrowed) / Number(supplied) : 0;
  const borrowApy = (1 + Number(formatUnits(ratePerSecond, 18))) ** 31_536_000 - 1;
  const supplyApy = borrowApy * utilisation * (1 - Number(formatUnits(reserveFactor, 18)));

  return {
    supplied: Number(formatUnits(supplied, 6)),
    borrowed: Number(formatUnits(borrowed, 6)),
    cash: Number(formatUnits(cash, 6)),
    supplyCap: Number(formatUnits(supplyCap, 6)),
    utilisation,
    borrowApy,
    supplyApy,
  };
}

export type Position = {
  collateralUsd: number;
  debtUsd: number;
  borrowPowerUsd: number;
  healthFactor: number | null;
  marketsOpen: boolean;
  holdings: { symbol: string; amount: number }[];
  priceStale: boolean;
};

/** Reads a borrower's position. Returns priceStale when the oracle has no fresh enough price to value it. */
export async function getPosition(account: Address): Promise<Position> {
  const holdings = [];
  for (const stock of XSTOCKS) {
    const amount = await client.readContract({
      address: deployment.vault,
      abi: marginVaultAbi,
      functionName: "collateralOf",
      args: [account, stock.wrapper as Address],
    });
    if (amount > 0n) holdings.push({ symbol: stock.symbol, amount: Number(formatUnits(amount, 18)) });
  }

  try {
    const [data, health] = await Promise.all([
      client.readContract({ address: deployment.vault, abi: marginVaultAbi, functionName: "accountData", args: [account] }),
      client.readContract({ address: deployment.vault, abi: marginVaultAbi, functionName: "healthFactor", args: [account] }),
    ]);

    return {
      collateralUsd: Number(formatUnits(data.collateralValue, 18)),
      debtUsd: Number(formatUnits(data.debtValue, 18)),
      borrowPowerUsd: Number(formatUnits(data.borrowPower, 18)),
      // The vault returns type(uint256).max when there is no debt.
      healthFactor: data.debtValue === 0n ? null : Number(formatUnits(health, 18)),
      marketsOpen: data.marketsOpen,
      holdings,
      priceStale: false,
    };
  } catch {
    return {
      collateralUsd: 0,
      debtUsd: 0,
      borrowPowerUsd: 0,
      healthFactor: null,
      marketsOpen: false,
      holdings,
      priceStale: true,
    };
  }
}

export type MarketPrice = { symbol: string; name: string; priceUsd: number | null; observedAt: number };

/** Wrapper prices: the signed share price from RedStone times the wrapper's live onchain multiplier. */
export async function getMarketPrices(): Promise<MarketPrice[]> {
  const listed = XSTOCKS.filter((stock) => stock.redstoneFeed);
  const response = await fetch(GATEWAY);
  const packages = response.ok ? ((await response.json()) as Record<string, unknown[]>) : {};

  return Promise.all(
    listed.map(async (stock) => {
      const entry = (packages[stock.redstoneFeed as string] ?? [])[0] as
        | { dataPoints: { value: number }[]; timestampMilliseconds: number }
        | undefined;
      if (!entry) return { symbol: stock.symbol, name: stock.name, priceUsd: null, observedAt: 0 };

      const multiplier = await client.readContract({
        address: stock.wrapper as Address,
        abi: erc4626Abi,
        functionName: "convertToAssets",
        args: [WAD],
      });

      return {
        symbol: stock.symbol,
        name: stock.name,
        priceUsd: entry.dataPoints[0].value * Number(formatUnits(multiplier, 18)),
        observedAt: Math.floor(entry.timestampMilliseconds / 1000),
      };
    }),
  );
}
