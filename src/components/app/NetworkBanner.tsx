"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { xLayer } from "wagmi/chains";
import { Button } from "@/components/ui";

/**
 * Being on the wrong network is not a cosmetic problem here.
 *
 * wagmi broadcasts a write to whichever chain the wallet is currently on, so an approval meant for
 * X Layer's USD₮0 would go to Ethereum, where that address is not the token - the wallet shows
 * "not on this chain" and the gas is spent for nothing. Every write now pins `chainId` so it fails
 * instead of broadcasting, but a refusal the person cannot act on is only half a fix. This is the half
 * they can act on, and it sits above the page rather than in the sidebar, which collapses.
 */
export function NetworkBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === xLayer.id) return null;

  return (
    <div
      role="alert"
      className="mb-7 flex flex-col gap-3 rounded-card border border-alarm/40 bg-alarm/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div>
        <p className="text-sm font-medium text-text">Your wallet is on another network</p>
        <p className="mt-1 text-sm text-muted">
          Equis is deployed on X Layer, chain 196. Nothing on this page will go through until you switch.
        </p>
      </div>
      <Button onClick={() => switchChain({ chainId: xLayer.id })} disabled={isPending} className="shrink-0">
        {isPending ? "Switching…" : "Switch to X Layer"}
      </Button>
    </div>
  );
}
