import { AppShell } from "@/components/AppShell";
import { AgentPanel } from "@/components/AgentPanel";
import { OneSignaturePanel } from "@/components/app/actions/OneSignaturePanel";

export default function AgentPage() {
  return (
    <AppShell
      title="Agent keys"
      lede="Under EIP-7702 your account can run Equis's delegate code and hand a narrow, expiring mandate to an agent - enforced in contract code, not in this interface."
    >
      <div className="space-y-6">
        <OneSignaturePanel />
        <AgentPanel />
      </div>
    </AppShell>
  );
}
