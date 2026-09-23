"use client";

import { useReadContracts } from "wagmi";
import { lendingPoolAbi } from "@/lib/abis";
import { deployment, isDeployed } from "@/lib/contracts";
import { apyFromRatePerSecond, formatAmount } from "@/lib/format";
import { NotDeployedNotice } from "./NotDeployedNotice";

export function PoolPanel() {
  const { data } = useReadContracts({
    contracts: [
      { address: deployment.pool!, abi: lendingPoolAbi, functionName: "totalAssets" } as const,
      { address: deployment.pool!, abi: lendingPoolAbi, functionName: "totalDebt" } as const,
      { address: deployment.pool!, abi: lendingPoolAbi, functionName: "borrowRatePerSecond" } as const,
      { address: deployment.pool!, abi: lendingPoolAbi, functionName: "supplyCap" } as const,
    ],
    query: { enabled: isDeployed, refetchInterval: 15_000 },
  });

  if (!isDeployed) {
    return (
      <NotDeployedNotice
        title="USD₮0 lending pool"
        description="Lenders will deposit USD₮0 here and earn the interest borrowers pay. Nothing is deployed yet, so there is no supply, utilisation or rate to show."
      />
    );
  }

  const totalAssets = data?.[0]?.result as bigint | undefined;
  const totalDebt = data?.[1]?.result as bigint | undefined;
  const rate = data?.[2]?.result as bigint | undefined;
  const supplyCap = data?.[3]?.result as bigint | undefined;
  const utilisation =
    totalAssets && totalDebt && totalAssets > 0n ? Number((totalDebt * 10_000n) / totalAssets) / 100 : 0;

  return (
    <section className="rounded-lg border border-line bg-panel p-5">
      <h2 className="text-sm font-medium text-text">USD₮0 lending pool</h2>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <Metric label="Supplied" value={totalAssets === undefined ? "…" : `${formatAmount(totalAssets, 6, 2)} USD₮0`} />
        <Metric label="Borrowed" value={totalDebt === undefined ? "…" : `${formatAmount(totalDebt, 6, 2)} USD₮0`} />
        <Metric label="Utilisation" value={`${utilisation.toFixed(2)}%`} />
        <Metric
          label="Borrow APY"
          value={rate === undefined ? "…" : `${(apyFromRatePerSecond(rate) * 100).toFixed(2)}%`}
        />
      </dl>
      {supplyCap !== undefined && (
        <p className="mt-3 text-[11px] text-muted">Supply cap {formatAmount(supplyCap, 6, 0)} USD₮0 (guarded launch)</p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-xl tabular-nums text-text">{value}</dd>
    </div>
  );
}
