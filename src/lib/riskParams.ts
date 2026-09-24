import type { Address } from "viem";
import { OKX_ADDRESS_URL } from "./contracts.ts";

/**
 * Risk parameters exactly as listed onchain by contracts/script/DeployEquis.s.sol.
 *
 * Only the three assets the vault actually lists appear here. wSPYx and wQQQx have no public price feed, so
 * they were never listed and there is no LTV to quote for them - callers get `undefined` and must say "not
 * listed" rather than print a number nothing onchain would honour.
 */
export const RISK_PARAMS: Record<string, { ltvBps: number; liquidationThresholdBps: number; capUsd: number }> = {
  wNVDAx: { ltvBps: 5_000, liquidationThresholdBps: 6_000, capUsd: 50_000 },
  wAAPLx: { ltvBps: 5_000, liquidationThresholdBps: 6_000, capUsd: 35_000 },
  wTSLAx: { ltvBps: 4_000, liquidationThresholdBps: 5_000, capUsd: 35_000 },
};

export const POOL_SUPPLY_CAP_USDT0 = 250_000n * 10n ** 6n;

export function explorerUrl(address: Address | string): string {
  return `${OKX_ADDRESS_URL}${address}`;
}
