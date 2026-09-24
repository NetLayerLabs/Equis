import type { CSSProperties } from "react";
import { Guilloche } from "@/components/brand/Motif";
import { Pill } from "@/components/ui";
import type { ChainFacts } from "@/lib/server/chainFacts";
import { cn } from "@/lib/cn";
import { RISK_PARAMS } from "@/lib/riskParams";

/*
 * The hero figures are Equis's own surfaces, not illustrations: every figure here is either a live
 * X Layer reading passed down from the server, or the protocol's actual rules. Nothing is invented.
 */

function formatMultiplier(multiplier: string): string {
  return (Number(multiplier) / 1e18).toFixed(6);
}

function formatSupply(totalSupply: string): string {
  return (Number(totalSupply) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** A collateral certificate: the wrapper, what one unit represents, and its supply on X Layer. */
export function CertificateFragment({
  fact,
  className,
  style,
}: {
  fact: ChainFacts["wrappers"][number] | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  const params = fact ? RISK_PARAMS[fact.symbol] : undefined;
  return (
    <figure
      className={cn("relative isolate overflow-hidden rounded-card border border-line bg-panel p-5 shadow-card", className)}
      style={style}
    >
      <Guilloche className="animate-spin-slow pointer-events-none absolute -right-16 -top-20 -z-10 size-64 text-brass/[0.13]" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-faint">Collateral certificate</p>
          <p className="mt-2 font-display text-2xl text-text">{fact?.symbol ?? "wNVDAx"}</p>
          <p className="text-xs text-muted">{fact?.name ?? "NVIDIA"} · xStocks wrapper</p>
        </div>
        <Pill tone="brass">X Layer</Pill>
      </div>
      <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Shares per unit</dt>
          <dd className="font-mono tabular-nums text-text">{fact ? formatMultiplier(fact.multiplier) : "-"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Supply on X Layer</dt>
          <dd className="font-mono tabular-nums text-text">{fact ? formatSupply(fact.totalSupply) : "-"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Max loan-to-value</dt>
          <dd className="font-mono tabular-nums text-brass">{params ? `${params.ltvBps / 100}%` : "-"}</dd>
        </div>
      </dl>
    </figure>
  );
}

/** How credit is drawn: the vault's actual formula, with the live USD₮0 price it settles in. */
export function CreditFragment({
  usdt0Usd,
  className,
  style,
}: {
  usdt0Usd: number | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <figure className={cn("rounded-card border border-line bg-panel-soft p-5 shadow-card", className)} style={style}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-faint">Credit line</p>
      <p className="mt-3 font-mono text-[0.8rem] leading-relaxed text-muted">
        collateral <span className="text-text">×</span> LTV <span className="text-text">=</span>{" "}
        <span className="text-brass">borrow power</span>
      </p>
      <div className="mt-4 space-y-2 border-t border-line pt-4 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-faint">Settles in</span>
          <span className="font-mono tabular-nums text-text">USD₮0</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-faint">USD₮0 / USD</span>
          <span className="font-mono tabular-nums text-text">
            {usdt0Usd ? `$${usdt0Usd.toFixed(4)}` : "-"}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-faint">Sold to draw it</span>
          <span className="font-mono tabular-nums text-signal">nothing</span>
        </div>
      </div>
    </figure>
  );
}

/** The agent's mandate: the exact permission shape EquisSessionDelegate enforces on a session key. */
export function GuardFragment({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <figure className={cn("rounded-card border border-line bg-panel p-5 shadow-card", className)} style={style}>
      <div className="flex items-center justify-between gap-3">
        <p className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-faint">Agent mandate · EIP-7702</p>
        <span className="size-1.5 animate-pulse-dot rounded-full bg-signal" aria-hidden="true" />
      </div>
      <ul className="mt-4 space-y-2.5 text-xs">
        {[
          ["May call", "repay · top up collateral"],
          ["May not call", "withdraw · borrow · approve"],
          ["Spend cap", "per token, per session"],
          ["Expires", "at a timestamp you set"],
        ].map(([label, value]) => (
          <li key={label} className="flex items-baseline justify-between gap-3 border-b border-line/70 pb-2 last:border-0">
            <span className="shrink-0 text-faint">{label}</span>
            <span className="font-mono text-right text-[0.7rem] leading-relaxed text-text">{value}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** The live strip along the bottom of the vignette: what the chain says right now. */
export function ChainStripFragment({ facts, className }: { facts: ChainFacts | null; className?: string }) {
  const items = [
    { label: "USD₮0 / USD", value: facts ? `$${facts.usdt0Usd.toFixed(4)}` : "-" },
    { label: "OKB / USD", value: facts ? `$${facts.okbUsd.toFixed(2)}` : "-" },
    { label: "Sequencer", value: facts ? (facts.sequencerUp ? "Up" : "Down") : "-" },
    { label: "Block", value: facts ? facts.blockNumber.toLocaleString("en-US") : "-" },
  ];
  return (
    <div className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4", className)}>
      {items.map((item) => (
        <div key={item.label} className="bg-panel px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-faint">{item.label}</p>
          <p className="mt-1 font-mono text-sm tabular-nums text-text">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
