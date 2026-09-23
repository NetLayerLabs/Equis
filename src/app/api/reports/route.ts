import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { fetchLatestReport } from "@/lib/chainlink/dataStreams";
import { XSTOCKS } from "@/lib/xstocks";

export const dynamic = "force-dynamic";

/**
 * Signed Data Streams reports, for transactions that must carry a price: borrow and withdraw pass these
 * straight to the vault, which verifies the DON signatures onchain. Credentials stay server-side.
 */
function credentials(): { apiKey: string; apiSecret: string } | null {
  if (!process.env.CHAINLINK_STREAMS_API_KEY || !process.env.CHAINLINK_STREAMS_API_SECRET) {
    try {
      process.loadEnvFile(resolve(process.cwd(), "contracts/.env"));
    } catch {
      // Fall through to the null result below.
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
    const reports = await Promise.all(
      XSTOCKS.map(async ({ symbol, wrapper, streamId }) => ({
        symbol,
        wrapper,
        fullReport: (await fetchLatestReport(streamId, creds)).fullReport,
      })),
    );
    return NextResponse.json({ reports }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Data Streams request failed" },
      { status: 502 },
    );
  }
}
