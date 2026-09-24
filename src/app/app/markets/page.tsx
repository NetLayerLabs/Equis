import { AppShell } from "@/components/AppShell";
import { MarketTable } from "@/components/MarketTable";

export default function MarketsPage() {
  return (
    <AppShell
      title="Collateral markets"
      lede="The xStocks wrappers Equis accepts. Share prices come from RedStone's signed feeds; multipliers and balances are read straight from the chain."
    >
      <MarketTable />
    </AppShell>
  );
}
