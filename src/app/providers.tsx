"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { xLayer } from "wagmi/chains";
import { X_LAYER_RPC_URL } from "@/lib/contracts";

// Wallets are discovered through EIP-6963 (OKX Wallet, MetaMask, …), so no connector is listed here.
// Importing wagmi/connectors would pull in the Base Account connector and its unresolvable x402 dependency.
const config = createConfig({
  chains: [xLayer],
  transports: { [xLayer.id]: http(X_LAYER_RPC_URL) },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
