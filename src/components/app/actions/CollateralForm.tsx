"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { parseUnits, type Address } from "viem";
import { xLayer } from "wagmi/chains";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { reportBytes, useStreamReports } from "@/hooks/useStreamReports";
import { erc20Abi, marginVaultAbi } from "@/lib/abis";
import { deployment } from "@/lib/contracts";
import { LISTED_XSTOCKS } from "@/lib/xstocks";
import { Button } from "@/components/ui";
import { AmountField } from "./AmountField";
import { TxFeedback } from "./TxFeedback";
import { useApproval } from "./useApproval";

const WRAPPER_DECIMALS = 18;

/** Deposits move tokens in; withdrawals must leave the account solvent, so they carry fresh prices. */
export function CollateralForm({ mode, lockedAsset }: { mode: "deposit" | "withdraw"; lockedAsset?: Address }) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Address>(LISTED_XSTOCKS[0].wrapper as Address);
  const asset = lockedAsset ?? selected;
  const setAsset = setSelected;
  const [amount, setAmount] = useState("");
  const reports = useStreamReports();

  const parsed = amount ? parseUnits(amount, WRAPPER_DECIMALS) : 0n;
  const vault = deployment.vault;

  const { data: walletBalance } = useReadContract({
    address: asset,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && mode === "deposit" },
  });

  const { data: deposited, queryKey: depositedKey } = useReadContract({
    address: vault,
    abi: marginVaultAbi,
    functionName: "collateralOf",
    args: address ? [address, asset] : undefined,
    query: { enabled: Boolean(address && vault) },
  });

  const approval = useApproval({ token: asset, spender: vault, amount: mode === "deposit" ? parsed : 0n });
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    void queryClient.invalidateQueries({ queryKey: depositedKey });
  }

  const submit = () => {
    if (!vault || parsed === 0n) return;
    reset();
    if (mode === "deposit") {
      writeContract({ chainId: xLayer.id, address: vault, abi: marginVaultAbi, functionName: "depositCollateral", args: [asset, parsed] });
    } else {
      writeContract({
        chainId: xLayer.id,
        address: vault,
        abi: marginVaultAbi,
        functionName: "withdrawCollateral",
        args: [asset, parsed, reportBytes(reports.data)],
      });
    }
  };

  const max = mode === "deposit" ? walletBalance : deposited;
  const needsReports = mode === "withdraw" && (deposited ?? 0n) > 0n;

  return (
    <div>
      {!lockedAsset && (
        <label className="block">
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
      )}

      <div className={lockedAsset ? "" : "mt-4"}>
        <AmountField
          label={mode === "deposit" ? "Amount to deposit" : "Amount to withdraw"}
          value={amount}
          onChange={setAmount}
          max={max}
          decimals={WRAPPER_DECIMALS}
          symbol={LISTED_XSTOCKS.find((s) => s.wrapper === asset)?.symbol ?? ""}
          disabled={!address}
        />
      </div>

      {needsReports && reports.isError && (
        <p className="mt-3 text-[11px] text-alarm">
          Withdrawing against debt needs a live price: {reports.error.message}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {mode === "deposit" && approval.needsApproval ? (
          <Button className="flex-1" onClick={approval.approve} disabled={!address || parsed === 0n || approval.isPending}>
            {approval.isPending || approval.isConfirming ? "Approving…" : "Approve"}
          </Button>
        ) : (
          <Button className="flex-1" onClick={submit} disabled={!address || parsed === 0n || isPending}>
            {isPending || isConfirming ? "Submitting…" : mode === "deposit" ? "Deposit" : "Withdraw"}
          </Button>
        )}
      </div>

      <TxFeedback
        hash={approval.needsApproval ? approval.hash : hash}
        isPending={approval.needsApproval ? approval.isPending : isPending}
        isConfirming={approval.needsApproval ? approval.isConfirming : isConfirming}
        isSuccess={approval.needsApproval ? approval.isSuccess : isSuccess}
        error={approval.needsApproval ? approval.error : error}
      />
    </div>
  );
}
