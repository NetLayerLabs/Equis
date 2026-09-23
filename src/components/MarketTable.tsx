"use client";

import type { Address } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { usePrices } from "@/hooks/usePrices";
import { erc20Abi, erc4626Abi } from "@/lib/abis";
import { isDeployed } from "@/lib/contracts";
import { formatAmount, formatBps, formatUsd } from "@/lib/format";
import { RISK_PARAMS, explorerUrl } from "@/lib/riskParams";
import { XSTOCKS } from "@/lib/xstocks";

const WAD = 10n ** 18n;

export function MarketTable() {
  const { address } = useAccount();
  const prices = usePrices();

  // One wrapper unit is one internal xStock share, so convertToAssets(1e18) is the live share multiplier.
  const { data: multipliers } = useReadContracts({
    contracts: XSTOCKS.map(
      (stock) =>
        ({
          address: stock.wrapper as Address,
          abi: erc4626Abi,
          functionName: "convertToAssets",
          args: [WAD],
        }) as const,
    ),
    query: { refetchInterval: 60_000 },
  });

  const { data: balances } = useReadContracts({
    contracts: XSTOCKS.map(
      (stock) =>
        ({
          address: stock.wrapper as Address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as Address],
        }) as const,
    ),
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-panel">
      <header className="border-b border-line px-4 py-3">
        <p className="text-[11px] text-muted">xStocks wrappers on X Layer · prices from Chainlink Data Streams</p>
      </header>

      {prices.isError && (
        <p className="border-b border-line bg-amber-500/5 px-4 py-3 text-xs text-amber-300">
          Live stock prices unavailable: {prices.error.message}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.18em] text-muted">
              <th className="px-4 py-2 font-normal">Asset</th>
              <th className="px-4 py-2 text-right font-normal">Price</th>
              <th className="px-4 py-2 text-right font-normal">Multiplier</th>
              <th className="px-4 py-2 text-right font-normal">Max LTV</th>
              <th className="px-4 py-2 text-right font-normal">Your balance</th>
              <th className="px-4 py-2 text-right font-normal">Market</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {XSTOCKS.map((stock, i) => {
              const price = prices.data?.prices.find((p) => p.wrapper === stock.wrapper);
              const priceWei = price ? BigInt(price.price) : undefined;
              const multiplier = multipliers?.[i]?.result as bigint | undefined;
              const balance = balances?.[i]?.result as bigint | undefined;
              const params = RISK_PARAMS[stock.symbol];

              return (
                <tr key={stock.wrapper} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <a
                      href={explorerUrl(stock.wrapper)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-text hover:text-brass"
                    >
                      {stock.symbol}
                    </a>
                    <div className="text-[11px] text-muted">{stock.name}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {priceWei ? formatUsd(priceWei) : prices.isLoading ? "…" : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                    {multiplier ? formatAmount(multiplier, 18, 6) : "…"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-muted">
                    {params ? formatBps(params.ltvBps) : "-"}
                    {!isDeployed && <span className="ml-1 text-[10px] uppercase text-muted/70">planned</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text">
                    {!address ? (
                      <span className="text-muted">-</span>
                    ) : balance === undefined ? (
                      "…"
                    ) : (
                      <>
                        {formatAmount(balance, 18, 4)}
                        {priceWei !== undefined && balance > 0n && (
                          <div className="text-[11px] text-muted">{formatUsd((balance * priceWei) / WAD)}</div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {price ? (
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] ${
                          price.marketOpen ? "bg-emerald-500/10 text-emerald-300" : "bg-white/5 text-muted"
                        }`}
                      >
                        {price.marketOpen ? "Open" : "Closed"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
