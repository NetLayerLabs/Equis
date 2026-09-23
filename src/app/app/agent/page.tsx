import { AppShell } from "@/components/AppShell";
import { AgentPanel } from "@/components/AgentPanel";

export default function AgentPage() {
  return (
    <AppShell
      title="Agent keys"
      lede="Under EIP-7702 your account can run Equis's delegate code and hand a narrow, expiring mandate to an agent that defends your position."
    >
      <AgentPanel />
    </AppShell>
  );
}
