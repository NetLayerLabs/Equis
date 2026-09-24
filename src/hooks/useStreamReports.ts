"use client";

import { useQuery } from "@tanstack/react-query";
import { encodeAbiParameters, parseAbiParameters, type Address, type Hex } from "viem";

export type RedStoneReport = {
  assets: Address[];
  symbols: string[];
  payload: Hex;
  observedAt: number;
};

/**
 * The signed RedStone payload a price-bearing transaction carries. Kept fresh because the oracle rejects a
 * payload older than three minutes.
 */
export function useStreamReports() {
  return useQuery<RedStoneReport>({
    queryKey: ["redstone-payload"],
    queryFn: async () => {
      const res = await fetch("/api/reports");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Payload request failed (${res.status})`);
      return body as RedStoneReport;
    },
    // Well inside the three-minute window, so a submitted transaction still verifies.
    refetchInterval: 45_000,
    retry: false,
  });
}

/** Packs the payload the way RedStonePriceOracle.updatePrices expects: abi.encode(address[], bytes). */
export function reportBytes(report: RedStoneReport | undefined): readonly Hex[] {
  if (!report) return [];
  return [encodeAbiParameters(parseAbiParameters("address[], bytes"), [report.assets, report.payload])];
}
