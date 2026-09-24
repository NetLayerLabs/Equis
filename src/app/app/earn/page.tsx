import { AppShell } from "@/components/AppShell";
import { EarnPanel } from "@/components/pool/EarnPanel";

export default function EarnPage() {
  return (
    <AppShell
      title="Earn"
      lede="Supply USD₮0 to the pool and earn what margin borrowers pay. Every figure is read from the deployed pool."
    >
      <EarnPanel />
    </AppShell>
  );
}
