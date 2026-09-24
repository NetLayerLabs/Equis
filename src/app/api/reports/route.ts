import { NextResponse } from "next/server";
import { RedstonePayload, SignedDataPackage } from "@redstone-finance/protocol";
import { REDSTONE_DATA_SERVICE_ID, REDSTONE_UNIQUE_SIGNERS } from "@/lib/redstone";
import { XSTOCKS } from "@/lib/xstocks";

/**
 * A signed RedStone payload for the collateral Equis prices. Borrow, withdraw and liquidate relay this to the
 * oracle, which verifies the DON signatures onchain, so it is safe to serve publicly and needs no credential.
 * RedStone's own SDK now requires an API key; the public gateway does not, and @redstone-finance/protocol
 * assembles the same payload the consumer parses.
 */
const GATEWAY = `https://oracle-gateway-1.a.redstone.finance/data-packages/latest/${REDSTONE_DATA_SERVICE_ID}`;

// The payload expires after three minutes onchain, so it is only cached for a few seconds.
export const revalidate = 5;

export async function GET() {
  try {
    const res = await fetch(GATEWAY, { next: { revalidate: 5 } });
    if (!res.ok) throw new Error(`RedStone gateway ${res.status}`);
    const all = (await res.json()) as Record<string, unknown[]>;

    const stocks = XSTOCKS.filter((stock) => stock.redstoneFeed);
    const signed = [];
    let observedAt = 0;

    for (const stock of stocks) {
      const entries = (all[stock.redstoneFeed as string] ?? []).slice(0, REDSTONE_UNIQUE_SIGNERS);
      if (entries.length < REDSTONE_UNIQUE_SIGNERS) {
        throw new Error(`${stock.redstoneFeed}: ${entries.length} packages, need ${REDSTONE_UNIQUE_SIGNERS}`);
      }
      for (const entry of entries) {
        signed.push(SignedDataPackage.fromObj(entry as never));
        const stamp = Math.floor((entry as { timestampMilliseconds: number }).timestampMilliseconds / 1000);
        observedAt = observedAt === 0 ? stamp : Math.min(observedAt, stamp);
      }
    }

    const payload = RedstonePayload.prepare(signed, "equis");
    return NextResponse.json({
      assets: stocks.map((stock) => stock.wrapper),
      symbols: stocks.map((stock) => stock.symbol),
      payload: payload.startsWith("0x") ? payload : `0x${payload}`,
      observedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RedStone payload build failed" },
      { status: 502 },
    );
  }
}
