import { AppShell } from "@/components/AppShell";
import { ChainStats } from "@/components/ChainStats";
import { PoolPanel } from "@/components/PoolPanel";
import { PositionPanel } from "@/components/PositionPanel";

export default function OverviewPage() {
  return (
    <AppShell title="Overview" lede="Your position, the lending pool and the feeds Equis prices against - read live from X Layer.">
      <div className="space-y-6">
        <ChainStats />
        <div className="grid gap-6 lg:grid-cols-2">
          <PositionPanel />
          <PoolPanel />
        </div>
      </div>
    </AppShell>
  );
}
