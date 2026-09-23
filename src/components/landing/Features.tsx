import { SectionHeading } from "@/components/ui";

const FEATURES = [
  {
    title: "Priced by proof, not by us",
    body: "Every stock price enters the vault as a Chainlink Data Streams report, signature-checked onchain in the same transaction that spends it. The vault values a wrapper at price × share multiplier, and refuses a price that is stale, mid corporate action, or taken while the sequencer was down.",
  },
  {
    title: "Market hours are part of the risk model",
    body: "US equities stop trading; crypto collateral does not. Equis reads Chainlink's market-status flag: while a market is closed you cannot borrow more or withdraw against that stock, but liquidations still clear at the last verified print.",
  },
  {
    title: "Agent keys that cannot run away",
    body: "The EIP-7702 delegate allows a session key only an explicit list of contract functions, caps what it may spend per token by measuring balances before and after, forbids sending OKB, and expires on its own. Vault actions have no recipient argument, so a key cannot redirect funds.",
  },
  {
    title: "Guarded by design, not by promise",
    body: "Per-stock supply caps are sized to the DEX depth that a liquidation would have to sell into. A guardian can pause borrowing without touching withdrawals, and lenders' funds can never be locked by a paused collateral token.",
  },
];

export function Features() {
  return (
    <section id="design" aria-labelledby="design-title" className="scroll-mt-20 border-b border-line bg-panel/30">
      <div className="shell py-20 sm:py-28">
        <SectionHeading
          eyebrow="Architecture"
          title={
            <>
              Built like a lending desk, <em className="font-display italic text-brass">not a demo</em>.
            </>
          }
          lede="The parts that decide whether an RWA credit protocol survives its first volatile week."
          className="max-w-2xl"
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="bg-panel p-6 sm:p-7">
              <h3 className="text-lg text-text">{feature.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{feature.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
