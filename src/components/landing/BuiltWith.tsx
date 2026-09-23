const STACK = [
  { name: "X Layer", detail: "Chain 196 · Prague, so EIP-7702 works" },
  { name: "xStocks", detail: "Backed's tokenized shares and ERC-4626 wrappers" },
  { name: "Chainlink", detail: "Data Streams reports, push feeds, sequencer uptime" },
  { name: "USD₮0", detail: "The credit asset borrowers receive" },
  { name: "OKX Agentic Wallet", detail: "Where a session key lives and acts" },
  { name: "Foundry", detail: "Contracts tested against forked mainnet state" },
];

export function BuiltWith() {
  return (
    <section aria-label="Built with" className="border-b border-line bg-panel/30">
      <div className="shell py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brass">Built with</p>
        <ul className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map((item) => (
            <li key={item.name} className="border-l border-line pl-4">
              <p className="text-sm text-text">{item.name}</p>
              <p className="text-xs text-faint">{item.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
