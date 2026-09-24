"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { reportBytes, useStreamReports } from "@/hooks/useStreamReports";
import { erc20Abi, lendingPoolAbi, marginVaultAbi } from "@/lib/abis";
import { USDT0, deployment } from "@/lib/contracts";
import { Button } from "@/components/ui";
import { AmountField } from "./AmountField";
import { TxFeedback } from "./TxFeedback";
import { useApproval } from "./useApproval";

const USDT0_DECIMALS = 6;

/** Borrowing carries a signed price; repayment pulls USD₮0 from the payer, who approves the pool. */
export function CreditForm({ mode }: { mode: "borrow" | "repay" }) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const reports = useStreamReports();

  const parsed = amount ? parseUnits(amount, USDT0_DECIMALS) : 0n;
  const { vault, pool } = deployment;

  const { data: debt, queryKey: debtKey } = useReadContract({
    address: pool,
    abi: lendingPoolAbi,
    functionName: "debtOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && pool) },
  });

  const { data: walletBalance } = useReadContract({
    address: USDT0,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // Repayments are pulled by the pool, so that is the contract the payer approves.
  const approval = useApproval({ token: USDT0, spender: pool, amount: mode === "repay" ? parsed : 0n });
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) void queryClient.invalidateQueries({ queryKey: debtKey });

  const submit = () => {
    if (!vault || parsed === 0n) return;
    reset();
    if (mode === "borrow") {
      writeContract({
        address: vault,
        abi: marginVaultAbi,
        functionName: "borrow",
        args: [parsed, reportBytes(reports.data)],
      });
    } else if (address) {
      writeContract({ address: vault, abi: marginVaultAbi, functionName: "repay", args: [address, parsed] });
    }
  };

  const max = mode === "repay" ? (walletBalance !== undefined && debt !== undefined
    ? (walletBalance < debt ? walletBalance : debt)
    : undefined) : undefined;

  return (
    <div>
      <AmountField
        label={mode === "borrow" ? "Amount to borrow" : "Amount to repay"}
        value={amount}
        onChange={setAmount}
        max={max}
        decimals={USDT0_DECIMALS}
        symbol="USD₮0"
        disabled={!address}
      />

      {mode === "borrow" && reports.isError && (
        <p className="mt-3 text-[11px] text-alarm">Borrowing needs a live price: {reports.error.message}</p>
      )}

      <div className="mt-4">
        {mode === "repay" && approval.needsApproval ? (
          <Button className="w-full" onClick={approval.approve} disabled={!address || parsed === 0n || approval.isPending}>
            {approval.isPending || approval.isConfirming ? "Approving…" : "Approve USD₮0"}
          </Button>
        ) : (
          <Button className="w-full" onClick={submit} disabled={!address || parsed === 0n || isPending}>
            {isPending || isConfirming ? "Submitting…" : mode === "borrow" ? "Borrow" : "Repay"}
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
