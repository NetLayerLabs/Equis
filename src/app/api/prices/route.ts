import { NextResponse } from "next/server";
import { XSTOCKS } from "@/lib/xstocks";

/**
 * Share prices from RedStone's public gateway. No credentials: the packages are signed by RedStone's
 * primary-prod signers, the same set the onchain consumer checks, so the price can be proven later.
 * The 24/5 feeds keep publishing outside US regular hours, which is when xStocks still trade.
 */
const GATEWAY = "https://oracle-gateway-1.a.redstone.finance/data-packages/latest/redstone-primary-prod";
const FRESH_SECONDS = 300;

type DataPackage = {
  dataPoints: { dataFeedId: string; value: number }[];
  timestampMilliseconds: number;
  signerAddress: string;
};

// The gateway returns every feed in one ~2MB document, so it is cached briefly and shared by all callers.
export const revalidate = 20;

export async function GET() {
  try {
    const res = await fetch(GATEWAY, { next: { revalidate: 20 } });
    if (!res.ok) throw new Error(`RedStone gateway ${res.status}`);
    const packages = (await res.json()) as Record<string, DataPackage[]>;
    const now = Math.floor(Date.now() / 1000);

    const prices = XSTOCKS.filter((stock) => stock.redstoneFeed).map((stock) => {
      const feed = packages[stock.redstoneFeed as string] ?? [];
      const value = feed[0]?.dataPoints[0]?.value;
      const observedAt = feed[0] ? Math.floor(feed[0].timestampMilliseconds / 1000) : 0;
      return {
        symbol: stock.symbol,
        name: stock.name,
        wrapper: stock.wrapper,
        feed: stock.redstoneFeed as string,
        // Share price as 1e18 fixed point; the wrapper's price is this times its onchain multiplier.
        sharePrice: value === undefined ? null : (BigInt(Math.round(value * 1e8)) * 10n ** 10n).toString(),
        signers: feed.length,
        observedAt,
        marketOpen: observedAt > 0 && now - observedAt < FRESH_SECONDS,
      };
    });

    return NextResponse.json({ prices, fetchedAt: now });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RedStone gateway request failed" },
      { status: 502 },
    );
  }
}
