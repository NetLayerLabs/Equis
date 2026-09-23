import type { Address } from "viem";

/**
 * Risk parameters as configured in contracts/script/DeployEquis.s.sol. Once the vault is deployed the UI reads
 * them from `collateralConfig` onchain; until then they're shown as the planned launch settings.
 */
export const RISK_PARAMS: Record<string, { ltvBps: number; liquidationThresholdBps: number; capUsd: number }> = {
  wNVDAx: { ltvBps: 5_000, liquidationThresholdBps: 6_000, capUsd: 50_000 },
  wAAPLx: { ltvBps: 5_000, liquidationThresholdBps: 6_000, capUsd: 35_000 },
  wTSLAx: { ltvBps: 4_000, liquidationThresholdBps: 5_000, capUsd: 35_000 },
  wSPYx: { ltvBps: 6_000, liquidationThresholdBps: 7_000, capUsd: 150_000 },
  wQQQx: { ltvBps: 6_000, liquidationThresholdBps: 7_000, capUsd: 75_000 },
};

export const POOL_SUPPLY_CAP_USDT0 = 250_000n * 10n ** 6n;

export function explorerUrl(address: Address | string): string {
  return `https://www.oklink.com/x-layer/address/${address}`;
}
