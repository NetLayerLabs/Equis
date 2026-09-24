"use client";

import { useAccount, useBytecode } from "wagmi";
import { Card, Pill } from "@/components/ui";
import { deployment, isDeployed } from "@/lib/contracts";
import { shortenAddress } from "@/lib/format";

const MANDATE = [
  ["May call", "repay · depositCollateral"],
  ["May not call", "withdrawCollateral · borrow · approve"],
  ["Spend cap", "per token, enforced by balance delta"],
  ["Native OKB", "never sent"],
  ["Expiry", "a timestamp you choose"],
  ["Revocable", "instantly, by you alone"],
];

/** Shows whether this account already runs the delegate, and exactly what a session key could do. */
export function AgentPanel() {
  const { address, isConnected } = useAccount();
  const { data: code } = useBytecode({ address, query: { enabled: Boolean(address) } });

  const delegated = Boolean(code && code !== "0x" && code.startsWith("0xef0100"));
  const delegateTarget = delegated && code ? `0x${code.slice(8)}` : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-text">This account</h2>
          {isConnected ? (
            <Pill tone={delegated ? "good" : "neutral"}>{delegated ? "Delegated" : "Plain EOA"}</Pill>
          ) : (
            <Pill>Not connected</Pill>
          )}
        </div>

        {!isConnected ? (
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Connect a wallet to check whether it already points at Equis&apos;s EIP-7702 delegate.
          </p>
        ) : delegated ? (
          <div className="mt-4 space-y-2 text-xs">
            <p className="text-muted">Your account currently runs delegate code:</p>
            <p className="font-mono text-text">{delegateTarget ? shortenAddress(delegateTarget) : ""}</p>
            <p className="text-faint">
              {delegateTarget?.toLowerCase() === deployment.sessionDelegate?.toLowerCase()
                ? "This is the Equis delegate."
                : "This is not the Equis delegate - another app set it."}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Your account holds no delegate code. Signing an EIP-7702 authorisation points it at Equis&apos;s
            delegate, which lets you batch approve, deposit and borrow into one transaction and grant agent keys.
          </p>
        )}

        {!isDeployed && (
          <p className="mt-5 border-t border-line pt-4 text-[11px] leading-relaxed text-faint">
            Granting a mandate needs the deployed delegate address. Deploy the contracts, then set
            NEXT_PUBLIC_EQUIS_SESSION_DELEGATE in .env.local.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-medium text-text">What a session key may do, once granted</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          The delegate enforces every line below in contract code, not in the interface. Granting runs through{" "}
          <span className="font-mono text-[0.7rem] text-text">EquisSessionDelegate.grantSession</span> - the contract
          is deployed and tested; the one-click grant is not in this build.
        </p>
        <dl className="mt-4 space-y-2.5 text-xs">
          {MANDATE.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line/70 pb-2 last:border-0">
              <dt className="shrink-0 text-faint">{label}</dt>
              <dd className="text-right font-mono text-[0.7rem] leading-relaxed text-text">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
