"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { parseUnits } from "viem";
import { xLayer } from "wagmi/chains";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { AmountField } from "@/components/app/actions/AmountField";
import { TxFeedback } from "@/components/app/actions/TxFeedback";
import { useApproval } from "@/components/app/actions/useApproval";
import { Button } from "@/components/ui";
import { erc20Abi, lendingPoolAbi } from "@/lib/abis";
import { USDT0, deployment } from "@/lib/contracts";

const USDT0_DECIMALS = 6;

/** Supplying and withdrawing USD₮0 as a lender. No price feed is involved, so this works even if a feed stalls. */
export function SupplyForm({ mode }: { mode: "supply" | "withdraw" }) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const parsed = amount ? parseUnits(amount, USDT0_DECIMALS) : 0n;

  const { data: walletBalance } = useReadContract({
    address: USDT0,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && mode === "supply" },
  });

  // maxWithdraw, not the share balance: it already accounts for USD₮0 currently lent out to borrowers.
  const { data: withdrawable, queryKey } = useReadContract({
    address: deployment.pool,
    abi: lendingPoolAbi,
    functionName: "maxWithdraw",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && mode === "withdraw" },
  });

  const approval = useApproval({ token: USDT0, spender: deployment.pool, amount: mode === "supply" ? parsed : 0n });
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) void queryClient.invalidateQueries({ queryKey });

  const submit = () => {
    if (!address || parsed === 0n) return;
    reset();
    if (mode === "supply") {
      writeContract({ chainId: xLayer.id, address: deployment.pool, abi: lendingPoolAbi, functionName: "deposit", args: [parsed, address] });
    } else {
      writeContract({
        chainId: xLayer.id,
        address: deployment.pool,
        abi: lendingPoolAbi,
        functionName: "withdraw",
        args: [parsed, address, address],
      });
    }
  };

  return (
    <div>
      <AmountField
        label={mode === "supply" ? "Amount to supply" : "Amount to withdraw"}
        value={amount}
        onChange={setAmount}
        max={mode === "supply" ? walletBalance : withdrawable}
        decimals={USDT0_DECIMALS}
        symbol="USD₮0"
        disabled={!address}
      />

      <div className="mt-4">
        {mode === "supply" && approval.needsApproval ? (
          <Button
            className="w-full"
            onClick={approval.approve}
            disabled={!address || parsed === 0n || approval.isPending}
          >
            {approval.isPending || approval.isConfirming ? "Approving…" : "Approve USD₮0"}
          </Button>
        ) : (
          <Button className="w-full" onClick={submit} disabled={!address || parsed === 0n || isPending}>
            {isPending || isConfirming ? "Submitting…" : mode === "supply" ? "Supply" : "Withdraw"}
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
