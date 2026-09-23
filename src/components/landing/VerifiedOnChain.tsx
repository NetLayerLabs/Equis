import { SectionHeading } from "@/components/ui";
import type { ChainFacts } from "@/lib/server/chainFacts";
import { explorerUrl } from "@/lib/riskParams";
import {
  CHAINLINK_STREAMS_VERIFIER_NOTE,
  VERIFIED_ADDRESSES,
} from "@/lib/verifiedAddresses";

function shorten(address: string) {
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

export function VerifiedOnChain({ facts }: { facts: ChainFacts | null }) {
  return (
    <section id="verified" aria-labelledby="verified-title" className="scroll-mt-20 border-b border-line bg-ink">
      <div className="shell py-20 sm:py-28">
        <SectionHeading
          eyebrow="Verified onchain"
          title={
            <>
              Addresses we checked <em className="font-display italic text-brass">ourselves</em>.
            </>
          }
          lede={CHAINLINK_STREAMS_VERIFIER_NOTE}
          className="max-w-2xl"
        />

        <div className="mt-12 overflow-x-auto rounded-card border border-line bg-panel">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.18em] text-faint">
                <th className="px-4 py-3 font-normal">Contract</th>
                <th className="px-4 py-3 font-normal">Role</th>
                <th className="px-4 py-3 text-right font-normal">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {VERIFIED_ADDRESSES.map((entry) => (
                <tr key={entry.address}>
                  <td className="px-4 py-3 text-text">{entry.label}</td>
                  <td className="px-4 py-3 text-muted">{entry.role}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={explorerUrl(entry.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-muted transition-colors hover:text-brass"
                    >
                      {shorten(entry.address)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {facts ? (
          <p className="mt-4 text-xs text-faint">
            Read at X Layer block {facts.blockNumber.toLocaleString("en-US")} · sequencer{" "}
            {facts.sequencerUp ? "up" : "down"} · USD₮0 ${facts.usdt0Usd.toFixed(4)}
          </p>
        ) : (
          <p className="mt-4 text-xs text-faint">Live readings unavailable right now; addresses above are fixed.</p>
        )}
      </div>
    </section>
  );
}
