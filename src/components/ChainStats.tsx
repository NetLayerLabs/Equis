"use client";

import { useReadContracts } from "wagmi";
import { aggregatorV3Abi } from "@/lib/abis";
import { CHAINLINK_OKB_USD, CHAINLINK_USDT0_USD, CHAINLINK_SEQUENCER_UPTIME } from "@/lib/contracts";
import { formatAge } from "@/lib/format";

/** Live Chainlink push feeds on X Layer - no deployment required. */
export function ChainStats() {
  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: CHAINLINK_USDT0_USD, abi: aggregatorV3Abi, functionName: "latestRoundData" },
      { address: CHAINLINK_OKB_USD, abi: aggregatorV3Abi, functionName: "latestRoundData" },
      { address: CHAINLINK_SEQUENCER_UPTIME, abi: aggregatorV3Abi, functionName: "latestRoundData" },
    ],
    query: { refetchInterval: 60_000 },
  });

  const usdt0 = data?.[0]?.result;
  const okb = data?.[1]?.result;
  const sequencer = data?.[2]?.result;
  const now = Math.floor(Date.now() / 1000);

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
      <Stat label="Network" value="X Layer · 196" hint="Chain ID" />
      <Stat
        label="USD₮0 / USD"
        value={usdt0 ? `$${(Number(usdt0[1]) / 1e8).toFixed(4)}` : isLoading ? "…" : "-"}
        hint={usdt0 ? formatAge(now - Number(usdt0[3])) : "Chainlink feed"}
      />
      <Stat
        label="OKB / USD"
        value={okb ? `$${(Number(okb[1]) / 1e8).toFixed(2)}` : isLoading ? "…" : "-"}
        hint={okb ? formatAge(now - Number(okb[3])) : "Chainlink feed"}
      />
      <Stat
        label="Sequencer"
        value={sequencer ? (Number(sequencer[1]) === 0 ? "Up" : "Down") : isLoading ? "…" : "-"}
        hint="Chainlink uptime feed"
      />
    </dl>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="bg-panel px-4 py-3">
      <dt className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-lg tabular-nums text-text">{value}</dd>
      <dd className="text-[11px] text-muted">{hint}</dd>
    </div>
  );
}
