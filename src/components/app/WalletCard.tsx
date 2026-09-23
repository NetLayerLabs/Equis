"use client";

import { useAccount, useChainId, useDisconnect, useConnect, useReadContract, useSwitchChain } from "wagmi";
import { xLayer } from "wagmi/chains";
import { erc20Abi } from "@/lib/abis";
import { USDT0 } from "@/lib/contracts";
import { formatAmount, shortenAddress } from "@/lib/format";
import { Button } from "@/components/ui";

/** The foot of the sidebar: which chain, which account, and what it can spend. */
export function WalletCard() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const { data: balance } = useReadContract({
    address: USDT0,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <div className="rounded-card border border-line bg-panel-soft p-4">
        <p className="text-[11px] leading-relaxed text-faint">
          Connect a wallet to see your collateral, debt and balances on X Layer.
        </p>
        <Button
          variant={connector ? "primary" : "secondary"}
          className="mt-3 w-full"
          disabled={!connector || isPending}
          onClick={() => connector && connect({ connector })}
        >
          {isPending ? "Connecting…" : connector ? "Connect wallet" : "No wallet detected"}
        </Button>
      </div>
    );
  }

  const wrongChain = chainId !== xLayer.id;

  return (
    <div className="rounded-card border border-line bg-panel-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            className={`size-1.5 rounded-full ${wrongChain ? "bg-alarm" : "animate-pulse-dot bg-signal"}`}
            aria-hidden="true"
          />
          <span className="text-[11px] font-medium text-muted">{wrongChain ? "Wrong network" : "X Layer"}</span>
        </span>
        <button type="button" onClick={() => disconnect()} className="text-[11px] text-faint transition-colors hover:text-text">
          Disconnect
        </button>
      </div>

      {wrongChain ? (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => switchChain({ chainId: xLayer.id })}>
          Switch to X Layer
        </Button>
      ) : (
        <>
          <p className="mt-2 font-mono text-xs text-text">{address ? shortenAddress(address) : ""}</p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-faint">USD₮0 balance</p>
          <p className="mt-1 font-mono text-lg tabular-nums text-text">
            {balance === undefined ? "…" : formatAmount(balance, 6, 2)}
          </p>
        </>
      )}
    </div>
  );
}
