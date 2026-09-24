"use client";

import { useQuery } from "@tanstack/react-query";

export type PriceRow = {
  symbol: string;
  name: string;
  wrapper: string;
  feed: string;
  /** Underlying share price, 1e18, as a decimal string. Null when the feed carried no value. */
  sharePrice: string | null;
  signers: number;
  observedAt: number;
  marketOpen: boolean;
};

export type PricesResponse = { prices: PriceRow[]; fetchedAt: number };

/** Live share prices, signed by RedStone's primary-prod signers and served without any credential. */
export function usePrices() {
  return useQuery<PricesResponse>({
    queryKey: ["share-prices"],
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
