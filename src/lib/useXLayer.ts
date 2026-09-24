"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { xLayer } from "wagmi/chains";
import { OKX_EXPLORER_URL, X_LAYER_RPC_URL } from "@/lib/contracts";

/**
 * Whether the wallet is actually on X Layer, and how to get it there.
 *
 * Not `useChainId()`: that reports the *config's* current chain, and this app configures `chains: [xLayer]`
 * only, so it answers 196 even while the wallet sits on Ethereum. Every guard built on it was therefore
 * dead code - which is exactly how an approval aimed at X Layer reached an Ethereum signing prompt.
 * `useAccount().chainId` is the connector's real chain.
 */
export function useXLayer() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error, reset } = useSwitchChain();

  return {
    isConnected,
    chainId,
    wrongChain: isConnected && chainId !== undefined && chainId !== xLayer.id,
    isSwitching: isPending,
    switchError: error,
    switchToXLayer: () => {
      reset();
      switchChain({
        chainId: xLayer.id,
        /*
         * A wallet that has never heard of X Layer answers wallet_switchEthereumChain with 4902. Passing
         * this is what lets the connector fall back to wallet_addEthereumChain and add the network rather
         * than simply failing, which is what Rabby does on a fresh profile.
         */
        addEthereumChainParameter: {
          chainName: "X Layer",
          nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
          rpcUrls: [X_LAYER_RPC_URL],
          blockExplorerUrls: [OKX_EXPLORER_URL],
        },
      });
    },
  };
}
