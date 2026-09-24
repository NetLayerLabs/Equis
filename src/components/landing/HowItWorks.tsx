import { Numeral, LedgerRule } from "@/components/brand/Motif";
import { SectionHeading } from "@/components/ui";

const STEPS = [
  {
    title: "Deposit tokenized shares",
    body: "Send wrapped xStocks - wNVDAx, wAAPLx, wTSLAx - into the vault. They stay yours: dividends and splits keep accruing through the wrapper's share multiplier while they sit as collateral. Only stocks with a public price feed are listed, because Equis will not lend against a price it cannot prove.",
  },
  {
    title: "Draw USD₮0 against them",
    body: "Borrow up to each stock's loan-to-value from an open lending pool. No sale, no taxable disposal, no lost upside. Lenders on the other side earn the interest you pay, set by utilisation.",
  },
  {
    title: "Give an agent a narrow mandate",
    body: "Under EIP-7702 your own account gains code. You grant a session key that may only repay or top up collateral, up to a spending cap, until an expiry you choose. It can never withdraw or borrow.",
  },
  {
    title: "The position defends itself",
    body: "When the health factor slips, the agent repays from your USD₮0 or adds collateral within its mandate - no approval round-trip at 3am. If it still falls through the threshold, anyone may liquidate at the last signed price the oracle verified.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-b border-line bg-ink">
      <div className="shell grid grid-cols-1 gap-12 py-20 sm:py-28 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            eyebrow="How it works"
            title={
              <>
                From share certificate to <em className="font-display italic text-brass">credit line</em>.
              </>
            }
            lede="Four steps. You hold the shares and make the decisions; Equis handles the collateral maths, the pricing and the night shift."
          />
          <LedgerRule className="mt-10 hidden max-w-xs lg:flex" />
        </div>

        <ol className="divide-y divide-line border-y border-line">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-6 py-7 first:pt-0 last:pb-0">
              <Numeral n={index + 1} className="pt-1" />
              <div>
                <h3 className="text-lg text-text">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
