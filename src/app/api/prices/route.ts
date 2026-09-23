import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { fetchLatestReport } from "@/lib/chainlink/dataStreams";
import { decodeReportV10, wrapperPrice, MARKET_STATUS_OPEN } from "@/lib/chainlink/report";
import { XSTOCKS } from "@/lib/xstocks";

export const dynamic = "force-dynamic";

/** Credentials stay server-side. They may live in the app env or in contracts/.env, used by the fetch script. */
function credentials(): { apiKey: string; apiSecret: string } | null {
  if (!process.env.CHAINLINK_STREAMS_API_KEY || !process.env.CHAINLINK_STREAMS_API_SECRET) {
    try {
      process.loadEnvFile(resolve(process.cwd(), "contracts/.env"));
    } catch {
      // No file: fall through to the null result below.
    }
  }
  const apiKey = process.env.CHAINLINK_STREAMS_API_KEY;
  const apiSecret = process.env.CHAINLINK_STREAMS_API_SECRET;
  return apiKey && apiSecret ? { apiKey, apiSecret } : null;
}

export async function GET() {
  const creds = credentials();
  if (!creds) {
    return NextResponse.json(
      { error: "Chainlink Data Streams credentials are not configured on the server (contracts/.env)." },
      { status: 503 },
    );
  }

  try {
    const prices = await Promise.all(
      XSTOCKS.map(async ({ symbol, name, wrapper, streamId }) => {
        const report = decodeReportV10((await fetchLatestReport(streamId, creds)).fullReport);
        return {
          symbol,
          name,
          wrapper,
          // Serialised as strings: JSON has no bigint.
          price: wrapperPrice(report).toString(),
          sharePrice: report.price.toString(),
          multiplier: report.currentMultiplier.toString(),
          marketOpen: report.marketStatus === MARKET_STATUS_OPEN,
          observedAt: report.observationsTimestamp,
          activationDateTime: report.activationDateTime,
        };
      }),
    );
    return NextResponse.json({ prices, fetchedAt: Math.floor(Date.now() / 1000) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Data Streams request failed" }, { status: 502 });
  }
}
