"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortenAddress } from "@/lib/format";
import { useXLayer } from "@/lib/useXLayer";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { wrongChain, isSwitching, switchToXLayer } = useXLayer();

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

  if (wrongChain) {
    return (
      <button
        type="button"
        onClick={switchToXLayer}
        disabled={isSwitching}
        className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 transition hover:bg-amber-500/20"
      >
        {isSwitching ? "Switching…" : "Switch to X Layer"}
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
