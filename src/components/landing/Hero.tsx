import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ExhibitCaption, Eyebrow } from "@/components/brand/Motif";
import { buttonClass } from "@/components/ui";
import type { ChainFacts } from "@/lib/server/chainFacts";
import { CertificateFragment, ChainStripFragment, CreditFragment, GuardFragment } from "./fragments";

const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

const ASSURANCES = [
  "You keep the shares and the upside",
  "Prices verified onchain, not quoted by us",
  "Agent keys are scoped, capped and expiring",
  "Reachable from a wallet, from Telegram, or from an AI agent over MCP",
];

/**
 * Tilt, entrance and drift each get their own element so their transforms compose rather than overwrite.
 * The periods are coprime-ish and the phases negative, so the cards never drift in lockstep and the motion
 * reads as continuous rather than as a pulse. Reduced-motion users get none of it (see globals.css).
 */
function Drift({
  tilt,
  rise,
  duration,
  phase,
  children,
}: {
  tilt: string;
  rise: number;
  duration: number;
  phase: number;
  children: ReactNode;
}) {
  return (
    <div className={tilt}>
      <div className="animate-rise" style={{ animationDelay: `${rise}s` }}>
        <div
          className="animate-float will-change-transform"
          style={{ animationDuration: `${duration}s`, animationDelay: `${phase}s` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Hero({ facts }: { facts: ChainFacts | null }) {
  const nvidia = facts?.wrappers.find((w) => w.symbol === "wNVDAx");

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-x-clip border-b border-line">
      <div aria-hidden="true" className="engrave absolute inset-x-0 top-0 -z-20 h-px" />
      <div
        aria-hidden="true"
        className="ledger-grid absolute inset-0 -z-20 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
      />
      <div className="shell grid grid-cols-1 gap-14 pb-20 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pb-28 lg:pt-20">
        <div className="lg:pt-8">
          <Eyebrow className="animate-rise">Institutional RWA credit · X Layer</Eyebrow>
          <h1
            id="hero-title"
            className="animate-rise mt-5 text-balance text-[2.5rem] font-light leading-[1.05] text-text sm:text-6xl lg:text-[3.6rem]"
            style={delay(0.05)}
          >
            Borrow against your shares.{" "}
            <em className="block font-display italic text-brass">Never sell them.</em>
          </h1>
          <p className="animate-rise mt-6 max-w-lg text-[1.05rem] leading-relaxed text-muted" style={delay(0.12)}>
            Equis turns tokenized stocks on X Layer into working collateral. Deposit wrapped NVDA, AAPL
            or TSLA, draw USD₮0 against them, and let a scoped agent key defend the position while the
            market moves.
          </p>

          <div className="animate-rise mt-8 flex flex-wrap items-center gap-3" style={delay(0.18)}>
            <Link href="/app" className={buttonClass("primary", "lg")}>
              Open dashboard
            </Link>
            <a href="#how" className={buttonClass("secondary", "lg")}>
              See how it works
            </a>
          </div>

          <ul className="animate-rise mt-10 space-y-2 border-t border-line pt-6 text-sm text-muted" style={delay(0.24)}>
            {ASSURANCES.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brass" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* The product itself, laid out like certificates on a dealing desk. */}
        <figure className="relative isolate mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute -inset-x-3 bottom-12 top-6 -z-10 rounded-[1.75rem] border border-line bg-panel/40 sm:-inset-x-5"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] sm:gap-5">
            <Drift tilt="sm:self-start sm:-rotate-1" rise={0.08} duration={7} phase={0}>
              <CertificateFragment fact={nvidia} />
            </Drift>
            <div className="flex flex-col gap-4 sm:gap-5 sm:pt-8">
              <Drift tilt="sm:rotate-1" rise={0.3} duration={8.5} phase={-2.6}>
                <CreditFragment usdt0Usd={facts?.usdt0Usd} />
              </Drift>
              <Drift tilt="sm:-rotate-1" rise={0.45} duration={10} phase={-5.4}>
                <GuardFragment />
              </Drift>
            </div>
          </div>
          <ChainStripFragment facts={facts} className="animate-rise mt-5" />
          <ExhibitCaption label="Exhibit A">
            Equis&apos;s own surfaces. Every figure above was read from X Layer mainnet when this page was
            served - nothing here is a sample.
          </ExhibitCaption>
        </figure>
      </div>
    </section>
  );
}
