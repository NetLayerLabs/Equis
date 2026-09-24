"use client";

import { useState } from "react";
import { zeroAddress, type Address } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { CollateralForm } from "@/components/app/actions/CollateralForm";
import { Card, Metric, Pill } from "@/components/ui";
import { usePrices } from "@/hooks/usePrices";
import { erc20Abi, erc4626Abi, marginVaultAbi } from "@/lib/abis";
import { cn } from "@/lib/cn";
import { OKX_ADDRESS_URL, deployment } from "@/lib/contracts";
import { formatAge, formatAmount, formatBps, formatUsd } from "@/lib/format";
import type { XStock } from "@/lib/xstocks";

const WAD = 10n ** 18n;

/** Everything Equis knows about one collateral market, read from the deployed contracts. */
export function MarketDetail({ stock }: { stock: XStock }) {
  const { address } = useAccount();
  const prices = usePrices();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const wrapper = stock.wrapper as Address;

  const { data } = useReadContracts({
    contracts: [
      { address: wrapper, abi: erc4626Abi, functionName: "convertToAssets", args: [WAD] },
      { address: wrapper, abi: erc4626Abi, functionName: "asset" },
      { address: wrapper, abi: erc20Abi, functionName: "totalSupply" },
      { address: wrapper, abi: erc20Abi, functionName: "balanceOf", args: [address ?? zeroAddress] },
      { address: deployment.vault, abi: marginVaultAbi, functionName: "collateralConfig", args: [wrapper] },
      {
        address: deployment.vault,
        abi: marginVaultAbi,
        functionName: "collateralOf",
        args: [address ?? zeroAddress, wrapper],
      },
    ],
    query: { refetchInterval: 30_000 },
  });

  const multiplier = data?.[0]?.result as bigint | undefined;
  const underlying = data?.[1]?.result as Address | undefined;
  const totalSupply = data?.[2]?.result as bigint | undefined;
  const walletBalance = data?.[3]?.result as bigint | undefined;
  const config = data?.[4]?.result as
    | readonly [boolean, boolean, number, number, number, number, bigint, bigint]
    | undefined;
  const deposited = data?.[5]?.result as bigint | undefined;

  const price = prices.data?.prices.find((row) => row.wrapper === stock.wrapper);
  const wrapperPrice = price?.sharePrice && multiplier ? (BigInt(price.sharePrice) * multiplier) / WAD : undefined;
  const capUsed = config && config[6] > 0n ? Number((config[7] * 10_000n) / config[6]) / 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-text">Price</h2>
              <p className="mt-1 text-[11px] text-muted">
                RedStone {stock.redstoneFeed ?? "(no public feed)"} · {price?.signers ?? "-"} signers
              </p>
            </div>
            {price ? (
              <Pill tone={price.marketOpen ? "good" : "neutral"}>{price.marketOpen ? "Market open" : "Closed"}</Pill>
            ) : (
              <Pill>No feed</Pill>
            )}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-5 border-t border-line pt-5">
            <Metric
              label="Price per wrapper"
              value={wrapperPrice ? formatUsd(wrapperPrice) : "-"}
              hint="share price x multiplier"
            />
            <Metric
              label="Underlying share"
              value={price?.sharePrice ? formatUsd(BigInt(price.sharePrice)) : "-"}
              hint={price ? `observed ${formatAge(Math.floor(Date.now() / 1000) - price.observedAt)}` : undefined}
            />
            <Metric
              label="Share multiplier"
              value={multiplier ? formatAmount(multiplier, 18, 6) : "…"}
              hint="grows with reinvested dividends"
            />
            <Metric
              label="Wrapper supply"
              value={totalSupply ? formatAmount(totalSupply, 18, 0) : "…"}
              hint="on X Layer"
            />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-medium text-text">Risk parameters</h2>
          <p className="mt-1 text-[11px] text-muted">Read from the vault, not from this page</p>
          <dl className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
            <Row label="Max loan-to-value" value={config ? formatBps(config[3]) : "…"} />
            <Row label="Liquidation threshold" value={config ? formatBps(config[4]) : "…"} />
            <Row label="Liquidation bonus" value={config ? formatBps(config[5]) : "…"} />
            <Row
              label="Supply cap"
              value={config ? `${formatAmount(config[6], 18, 2)} ${stock.symbol}` : "…"}
            />
            <Row label="Cap used" value={config ? `${capUsed.toFixed(2)}%` : "…"} />
            <Row
              label="Deposits"
              value={config ? (config[1] ? "Open" : "Paused") : "…"}
              tone={config && !config[1] ? "alarm" : "default"}
            />
          </dl>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="text-sm font-medium text-text">Your position in this market</h2>
          <dl className="mt-5 grid grid-cols-2 gap-5 border-t border-line pt-5">
            <Metric
              label="In your wallet"
              value={!address ? "-" : walletBalance === undefined ? "…" : formatAmount(walletBalance, 18, 4)}
              hint={
                walletBalance !== undefined && wrapperPrice !== undefined && walletBalance > 0n
                  ? formatUsd((walletBalance * wrapperPrice) / WAD)
                  : undefined
              }
            />
            <Metric
              label="Deposited as collateral"
              value={!address ? "-" : deposited === undefined ? "…" : formatAmount(deposited, 18, 4)}
              hint={
                deposited !== undefined && wrapperPrice !== undefined && deposited > 0n
                  ? formatUsd((deposited * wrapperPrice) / WAD)
                  : undefined
              }
            />
          </dl>

          <div className="mt-6 space-y-2 border-t border-line pt-4 text-[11px]">
            <AddressRow label="Wrapper" address={stock.wrapper} />
            {underlying && <AddressRow label="Underlying xStock" address={underlying} />}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex gap-1 rounded-lg border border-line bg-ink p-1">
            {(["deposit", "withdraw"] as const).map((item) => (
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
            <CollateralForm mode={tab} lockedAsset={wrapper} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "alarm" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("font-mono text-sm tabular-nums", tone === "alarm" ? "text-alarm" : "text-text")}>{value}</dd>
    </div>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-faint">{label}</span>
      <a
        href={`${OKX_ADDRESS_URL}${address}`}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-muted transition-colors hover:text-brass"
      >
        {address.slice(0, 10)}…{address.slice(-6)}
      </a>
    </div>
  );
}
