"use client";

import { Button } from "@/components/ui";
import { useXLayer } from "@/lib/useXLayer";

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
  const { wrongChain, chainId, isSwitching, switchError, switchToXLayer } = useXLayer();

  if (!wrongChain) return null;

  return (
    <div
      role="alert"
      className="mb-7 rounded-card border border-alarm/40 bg-alarm/[0.08] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div>
          <p className="text-sm font-medium text-text">Your wallet is on the wrong network</p>
          <p className="mt-1 text-sm text-muted">
            Equis is deployed on X Layer, chain 196. Your wallet is on chain {chainId}, where none of these
            addresses exist, so nothing on this page will go through until you switch.
          </p>
        </div>
        <Button onClick={switchToXLayer} disabled={isSwitching} className="shrink-0">
          {isSwitching ? "Switching…" : "Switch to X Layer"}
        </Button>
      </div>

      {switchError ? (
        <p className="mt-3 border-t border-alarm/30 pt-3 text-[0.8125rem] leading-relaxed text-muted">
          The wallet refused to switch: {switchError.message} If it does not offer to add X Layer, add it by
          hand - chain 196, RPC <code className="font-mono text-xs text-text">https://rpc.xlayer.tech</code>,
          currency OKB.
        </p>
      ) : null}
    </div>
  );
}
