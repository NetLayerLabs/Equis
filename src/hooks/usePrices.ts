"use client";

import { useQuery } from "@tanstack/react-query";

export type PriceRow = {
  symbol: string;
  name: string;
  wrapper: string;
  /** USD price of one wrapper unit, 1e18, as a decimal string. */
  price: string;
  sharePrice: string;
  multiplier: string;
  marketOpen: boolean;
  observedAt: number;
  activationDateTime: number;
};

export type PricesResponse = { prices: PriceRow[]; fetchedAt: number };

/** Live Chainlink Data Streams prices, fetched through our server route so the API key stays server-side. */
export function usePrices() {
  return useQuery<PricesResponse>({
    queryKey: ["stream-prices"],
    queryFn: async () => {
      const res = await fetch("/api/prices");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Price request failed (${res.status})`);
      return body as PricesResponse;
    },
    refetchInterval: 30_000,
    retry: false,
  });
}
