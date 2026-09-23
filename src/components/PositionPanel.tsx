"use client";

import { useAccount, useReadContracts } from "wagmi";
import { marginVaultAbi } from "@/lib/abis";
import { deployment, isDeployed } from "@/lib/contracts";
import { formatHealthFactor, formatUsd } from "@/lib/format";
import { NotDeployedNotice } from "./NotDeployedNotice";

export function PositionPanel() {
  const { address, isConnected } = useAccount();

  const { data } = useReadContracts({
    contracts: [
      {
        address: deployment.vault!,
        abi: marginVaultAbi,
        functionName: "accountData",
        args: [address!],
      } as const,
      {
        address: deployment.vault!,
        abi: marginVaultAbi,
        functionName: "healthFactor",
        args: [address!],
      } as const,
    ],
    query: { enabled: isDeployed && Boolean(address), refetchInterval: 15_000 },
  });

  if (!isDeployed) {
    return (
      <NotDeployedNotice
        title="Your position"
        description="The margin vault isn't deployed to X Layer yet, so there is no position data to read. Deploy the contracts and this panel fills in with your collateral, debt and health factor straight from the chain."
      />
    );
  }

  if (!isConnected) {
    return (
      <section className="rounded-lg border border-line bg-panel p-5">
        <h2 className="text-sm font-medium text-text">Your position</h2>
        <p className="mt-2 text-xs text-muted">Connect a wallet to see your collateral, debt and health factor.</p>
      </section>
    );
  }

  const account = data?.[0]?.result;
  const health = data?.[1]?.result as bigint | undefined;

  return (
    <section className="rounded-lg border border-line bg-panel p-5">
      <h2 className="text-sm font-medium text-text">Your position</h2>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <Metric label="Collateral" value={account ? formatUsd(account.collateralValue) : "…"} />
        <Metric label="Debt" value={account ? formatUsd(account.debtValue) : "…"} />
        <Metric label="Borrow power" value={account ? formatUsd(account.borrowPower) : "…"} />
        <Metric
          label="Health factor"
          value={health === undefined ? "…" : formatHealthFactor(health)}
          tone={health !== undefined && health < 10n ** 18n ? "danger" : "default"}
        />
      </dl>
    </section>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className={`mt-1 font-mono text-xl tabular-nums ${tone === "danger" ? "text-red-400" : "text-text"}`}>
        {value}
      </dd>
    </div>
  );
}
