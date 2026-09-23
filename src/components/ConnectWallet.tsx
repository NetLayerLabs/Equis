"use client";

import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { xLayer } from "wagmi/chains";
import { shortenAddress } from "@/lib/format";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <button
        type="button"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector })}
        className="rounded-md border border-brass/40 bg-brass/10 px-4 py-2 text-sm font-medium text-brass transition hover:bg-brass/20 disabled:opacity-50"
      >
        {isPending ? "Connecting…" : connector ? "Connect wallet" : "No wallet detected"}
      </button>
    );
  }

  if (chainId !== xLayer.id) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: xLayer.id })}
        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
      >
        Switch to X Layer
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => disconnect()}
      className="rounded-md border border-line bg-panel px-4 py-2 font-mono text-sm text-text transition hover:border-brass/40"
    >
      {address ? shortenAddress(address) : ""}
    </button>
  );
}
