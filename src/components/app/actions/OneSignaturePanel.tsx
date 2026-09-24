"use client";

import { useState } from "react";
import { encodeFunctionData, parseUnits, type Address } from "viem";
import { useAccount, useCapabilities, useSendCalls, useWaitForCallsStatus } from "wagmi";
import { xLayer } from "wagmi/chains";
import { reportBytes, useStreamReports } from "@/hooks/useStreamReports";
import { erc20Abi, marginVaultAbi } from "@/lib/abis";
import { deployment, isDeployed } from "@/lib/contracts";
import { LISTED_XSTOCKS } from "@/lib/xstocks";
import { Button, Card, Pill } from "@/components/ui";
import { AmountField } from "./AmountField";

/**
 * Approve, deposit and borrow as one atomic batch. Wallets implement EIP-5792 batching on top of EIP-7702,
 * so the account temporarily runs delegate code and the three calls need a single approval.
 */
export function OneSignaturePanel() {
  const { address } = useAccount();
  const [asset, setAsset] = useState<Address>(LISTED_XSTOCKS[0].wrapper as Address);
  const [collateral, setCollateral] = useState("");
  const [borrow, setBorrow] = useState("");
  const reports = useStreamReports();

  const { data: capabilities } = useCapabilities({ account: address, query: { enabled: Boolean(address) } });
  const atomic = capabilities?.[xLayer.id]?.atomic?.status;
  const supportsBatch = atomic === "supported" || atomic === "ready";

  const { sendCalls, data: result, isPending, error } = useSendCalls();
  const { data: status } = useWaitForCallsStatus({ id: result?.id, query: { enabled: Boolean(result?.id) } });

  const vault = deployment.vault;
  const collateralAmount = collateral ? parseUnits(collateral, 18) : 0n;
  const borrowAmount = borrow ? parseUnits(borrow, 6) : 0n;
  const ready = Boolean(address && vault && collateralAmount > 0n && borrowAmount > 0n);

  const open = () => {
    if (!vault || !ready) return;
    sendCalls({
      calls: [
        {
          to: asset,
          data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [vault, collateralAmount] }),
        },
        {
          to: vault,
          data: encodeFunctionData({
            abi: marginVaultAbi,
            functionName: "depositCollateral",
            args: [asset, collateralAmount],
          }),
        },
        {
          to: vault,
          data: encodeFunctionData({
            abi: marginVaultAbi,
            functionName: "borrow",
            args: [borrowAmount, reportBytes(reports.data)],
          }),
        },
      ],
    });
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-text">Open a position in one signature</h2>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-muted">
            Approve, deposit and borrow travel together as one atomic batch. Either all three land or none do.
          </p>
        </div>
        {address && <Pill tone={supportsBatch ? "good" : "neutral"}>{supportsBatch ? "Wallet supports batching" : "Wallet cannot batch"}</Pill>}
      </div>

      {!isDeployed ? (
        <p className="mt-4 border-t border-line pt-4 text-[11px] leading-relaxed text-faint">
          Available once the vault is deployed to X Layer.
        </p>
      ) : (
        <>
          <label className="mt-5 block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-faint">Collateral</span>
            <select
              value={asset}
              onChange={(event) => setAsset(event.target.value as Address)}
              className="mt-2 w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text outline-none focus:border-brass/50"
            >
              {LISTED_XSTOCKS.map((stock) => (
                <option key={stock.wrapper} value={stock.wrapper}>
                  {stock.symbol} · {stock.name}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AmountField
              label="Deposit"
              value={collateral}
              onChange={setCollateral}
              decimals={18}
              symbol={LISTED_XSTOCKS.find((s) => s.wrapper === asset)?.symbol ?? ""}
              disabled={!address}
            />
            <AmountField
              label="Borrow"
              value={borrow}
              onChange={setBorrow}
              decimals={6}
              symbol="USD₮0"
              disabled={!address}
            />
          </div>

          <Button className="mt-4 w-full" onClick={open} disabled={!ready || isPending || !supportsBatch}>
            {isPending ? "Confirm in wallet…" : "Deposit and borrow"}
          </Button>

          {!supportsBatch && address && (
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              This wallet does not advertise atomic batching on X Layer. Use the Deposit and Borrow tabs on the
              overview instead, which send the same calls one at a time.
            </p>
          )}
          {error && <p className="mt-3 text-[11px] text-alarm">{error.message.split("\n")[0]}</p>}
          {status?.status === "success" && <p className="mt-3 text-[11px] text-signal">Position opened.</p>}
        </>
      )}
    </Card>
  );
}
