"use client";

import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";

export type SignedReport = { symbol: string; wrapper: string; fullReport: Hex };

/**
 * The signed reports a price-bearing transaction must carry. Kept fresh because the vault rejects a
 * report older than its staleness window.
 */
export function useStreamReports() {
  return useQuery<{ reports: SignedReport[] }>({
    queryKey: ["stream-reports-signed"],
    queryFn: async () => {
      const res = await fetch("/api/reports");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Report request failed (${res.status})`);
      return body;
    },
    refetchInterval: 45_000,
    retry: false,
  });
}

export function reportBytes(reports: SignedReport[] | undefined): readonly Hex[] {
  return reports?.map((report) => report.fullReport) ?? [];
}
