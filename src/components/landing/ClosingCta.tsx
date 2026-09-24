import Link from "next/link";
import { Guilloche } from "@/components/brand/Motif";
import { buttonClass } from "@/components/ui";

export function ClosingCta() {
  return (
    <section className="relative isolate overflow-hidden border-b border-line bg-ink">
      <Guilloche className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[42rem] -translate-x-1/2 -translate-y-1/2 text-brass/[0.07]" />
      <div className="mx-auto w-full max-w-3xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <h2 className="text-balance text-3xl font-light leading-[1.12] text-text sm:text-5xl">
          Your shares are already onchain.{" "}
          <em className="font-display italic text-brass">Put them to work.</em>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[0.95rem] leading-relaxed text-muted">
          Open the dashboard to see live collateral prices, the lending pool and your position - read straight
          from X Layer mainnet.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/app" className={buttonClass("primary", "lg")}>
            Open dashboard
          </Link>
          <a
            href="https://web3.okx.com/explorer/x-layer"
            target="_blank"
            rel="noreferrer"
            className={buttonClass("secondary", "lg")}
          >
            Explore X Layer
          </a>
        </div>
      </div>
    </section>
  );
}
