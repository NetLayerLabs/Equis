import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { MarketDetail } from "@/components/app/MarketDetail";
import { XSTOCKS } from "@/lib/xstocks";

export function generateStaticParams() {
  return XSTOCKS.map((stock) => ({ symbol: stock.symbol }));
}

export default function MarketPage({ params }: { params: { symbol: string } }) {
  const stock = XSTOCKS.find((entry) => entry.symbol.toLowerCase() === params.symbol.toLowerCase());
  if (!stock) notFound();

  return (
    <AppShell title={stock.symbol} lede={`${stock.name} · xStocks wrapper accepted as collateral on X Layer.`}>
      <Link href="/app/markets" className="mb-6 inline-block text-xs text-muted transition-colors hover:text-brass">
        ← All markets
      </Link>
      <MarketDetail stock={stock} />
    </AppShell>
  );
}
