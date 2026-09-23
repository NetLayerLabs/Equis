/** Formatting helpers. All onchain values arrive as bigint; nothing here invents or rounds away precision silently. */

export function formatUsd(value: bigint, decimals = 18, maximumFractionDigits = 2): string {
  return `$${formatUnitsToNumber(value, decimals).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  })}`;
}

export function formatAmount(value: bigint, decimals: number, maximumFractionDigits = 4): string {
  return formatUnitsToNumber(value, decimals).toLocaleString("en-US", { maximumFractionDigits });
}

export function formatPercent(wad: bigint, maximumFractionDigits = 2): string {
  return `${(formatUnitsToNumber(wad, 18) * 100).toLocaleString("en-US", { maximumFractionDigits })}%`;
}

export function formatBps(bps: number): string {
  return `${bps / 100}%`;
}

/** Per-second rate (1e18 = 100%/s) compounded over a year. */
export function apyFromRatePerSecond(ratePerSecond: bigint): number {
  const perSecond = formatUnitsToNumber(ratePerSecond, 18);
  return (1 + perSecond) ** 31_536_000 - 1;
}

export function formatHealthFactor(healthFactor: bigint): string {
  // The vault returns type(uint256).max when an account has no debt.
  if (healthFactor > 10n ** 30n) return "∞";
  return formatUnitsToNumber(healthFactor, 18).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

function formatUnitsToNumber(value: bigint, decimals: number): number {
  return Number(value) / 10 ** decimals;
}
