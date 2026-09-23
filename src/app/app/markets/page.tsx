import { AppShell } from "@/components/AppShell";
import { MarketTable } from "@/components/MarketTable";

export default function MarketsPage() {
  return (
    <AppShell
      title="Collateral markets"
      lede="The xStocks wrappers Equis accepts. Prices arrive as Chainlink Data Streams reports; multipliers and balances are read from the chain."
    >
      <MarketTable />
    </AppShell>
  );
}
