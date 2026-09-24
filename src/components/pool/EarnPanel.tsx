"use client";

import { useState } from "react";
import { zeroAddress } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { Card, Metric, Pill } from "@/components/ui";
import { lendingPoolAbi } from "@/lib/abis";
import { cn } from "@/lib/cn";
import { deployment } from "@/lib/contracts";
import { apyFromRatePerSecond, formatAmount } from "@/lib/format";
import { SupplyForm } from "./SupplyForm";

/** The lender's side of the market: what the pool holds, what it pays, and what you can take back today. */
export function EarnPanel() {
  const { address } = useAccount();
  const [tab, setTab] = useState<"supply" | "withdraw">("supply");

  const { data } = useReadContracts({
    contracts: [
      { address: deployment.pool, abi: lendingPoolAbi, functionName: "totalAssets" },
      { address: deployment.pool, abi: lendingPoolAbi, functionName: "totalDebt" },
      { address: deployment.pool, abi: lendingPoolAbi, functionName: "cash" },
      { address: deployment.pool, abi: lendingPoolAbi, functionName: "supplyCap" },
      { address: deployment.pool, abi: lendingPoolAbi, functionName: "reserveFactor" },
      { address: deployment.pool, abi: lendingPoolAbi, functionName: "borrowRatePerSecond" },
      { address: deployment.pool, abi: lendingPoolAbi, functionName: "balanceOf", args: [address ?? zeroAddress] },
      { address: deployment.pool, abi: lendingPoolAbi, functionName: "maxWithdraw", args: [address ?? zeroAddress] },
    ],
    query: { refetchInterval: 20_000 },
  });

  const totalAssets = data?.[0]?.result as bigint | undefined;
  const totalDebt = data?.[1]?.result as bigint | undefined;
  const cash = data?.[2]?.result as bigint | undefined;
  const supplyCap = data?.[3]?.result as bigint | undefined;
  const reserveFactor = data?.[4]?.result as bigint | undefined;
  const borrowRate = data?.[5]?.result as bigint | undefined;
  const shares = data?.[6]?.result as bigint | undefined;
  const withdrawable = data?.[7]?.result as bigint | undefined;

  const { data: claim } = useReadContract({
    address: deployment.pool,
    abi: lendingPoolAbi,
    functionName: "convertToAssets",
    args: shares !== undefined ? [shares] : undefined,
    query: { enabled: shares !== undefined && shares > 0n, refetchInterval: 20_000 },
  });

  const utilisation =
    totalAssets && totalDebt && totalAssets > 0n ? Number((totalDebt * 10_000n) / totalAssets) / 100 : 0;
  const borrowApy = borrowRate === undefined ? undefined : apyFromRatePerSecond(borrowRate) * 100;
  // Lenders earn the borrow rate, scaled by how much of the pool is lent out, less the protocol's reserve cut.
  const supplyApy =
    borrowApy === undefined || reserveFactor === undefined
      ? undefined
      : borrowApy * (utilisation / 100) * (1 - Number(reserveFactor) / 1e18);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium text-text">USD₮0 lending pool</h2>
          <Pill tone="brass">ERC-4626</Pill>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-5 border-t border-line pt-5 lg:grid-cols-4">
          <Metric
            label="Supplied"
            value={totalAssets === undefined ? "…" : formatAmount(totalAssets, 6, 2)}
            hint={supplyCap !== undefined ? `cap ${formatAmount(supplyCap, 6, 0)}` : undefined}
          />
          <Metric label="Borrowed" value={totalDebt === undefined ? "…" : formatAmount(totalDebt, 6, 2)} />
          <Metric label="Utilisation" value={`${utilisation.toFixed(2)}%`} hint="borrowed / supplied" />
          <Metric
            label="Supply APY"
            value={supplyApy === undefined ? "…" : `${supplyApy.toFixed(2)}%`}
            hint={borrowApy === undefined ? undefined : `borrowers pay ${borrowApy.toFixed(2)}%`}
          />
        </dl>
        {cash !== undefined && (
          <p className="mt-4 text-[11px] text-faint">
            {formatAmount(cash, 6, 2)} USD₮0 sits idle in the pool and can be withdrawn right now; the rest is lent
            out and returns as borrowers repay.
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="text-sm font-medium text-text">Your supply</h2>
          <dl className="mt-5 grid grid-cols-2 gap-5 border-t border-line pt-5">
            <Metric
              label="Your claim"
              value={!address ? "-" : claim === undefined ? (shares === 0n ? "0.00" : "…") : formatAmount(claim, 6, 2)}
              hint="principal plus interest earned"
            />
            <Metric
              label="Available now"
              value={!address ? "-" : withdrawable === undefined ? "…" : formatAmount(withdrawable, 6, 2)}
              hint="limited by idle cash"
            />
          </dl>
          <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-faint">
            Lenders earn what borrowers pay, less a {reserveFactor === undefined ? "10" : (Number(reserveFactor) / 1e16).toFixed(0)}%
            reserve. Your claim grows every block a loan is outstanding; nothing is locked, but withdrawals are
            capped by the cash not currently lent out.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex gap-1 rounded-lg border border-line bg-ink p-1">
            {(["supply", "withdraw"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs capitalize transition-colors",
                  tab === item ? "bg-brass/10 text-brass" : "text-muted hover:text-text",
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="mt-5">
            <SupplyForm mode={tab} />
          </div>
        </Card>
      </div>
    </div>
  );
}
