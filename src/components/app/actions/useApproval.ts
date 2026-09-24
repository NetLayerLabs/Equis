"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import { xLayer } from "wagmi/chains";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { erc20Abi } from "@/lib/abis";

/**
 * ERC-20 allowance for one spender. Equis approves the exact amount rather than an unlimited allowance,
 * so a stale approval can never be drained later.
 */
export function useApproval({ token, spender, amount }: { token?: Address; spender?: Address; amount: bigint }) {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const { data: allowance, queryKey } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && spender ? [address, spender] : undefined,
    query: { enabled: Boolean(address && token && spender) },
  });

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) void queryClient.invalidateQueries({ queryKey });

  return {
    needsApproval: amount > 0n && (allowance === undefined || allowance < amount),
    approve: () => {
      if (!token || !spender) return;
      reset();
      writeContract({ chainId: xLayer.id, address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
    },
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
