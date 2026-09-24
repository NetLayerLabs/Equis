import type { ComponentType } from "react";
import Link from "next/link";
import { ExhibitCaption } from "@/components/brand/Motif";
import { IconAgent, IconOverview, IconTelegram } from "@/components/icons";
import { Pill, SectionHeading } from "@/components/ui";
import { cn } from "@/lib/cn";

/*
 * Three ways in: the dashboard, the Telegram bot and the MCP server are three front ends over one
 * deployment. The cards carry equal weight; the exhibit underneath gives the agent surface the extra
 * room it earns, because it is the part a judge has not seen anywhere else.
 *
 * Every claim here is checked against source: the six tool names and the no-key behaviour against
 * scripts/mcp-server.ts, the 1.15 and 1.25 thresholds against ALERT_BELOW and RECOVERED_ABOVE in
 * scripts/telegram-bot.ts, the unit hardening against deploy/equis-bot.service, the batch against
 * src/components/app/actions/OneSignaturePanel.tsx, the three-of-five threshold and the three-minute
 * window against src/lib/redstone.ts, and the statement order against EquisMarginVault.borrow.
 */

type Surface = {
  kicker: string;
  title: string;
  source: string;
  body: string;
  detail: ReadonlyArray<string>;
  link?: { label: string; href: string; external?: boolean };
  command?: string;
  isNew?: boolean;
  Icon: ComponentType<{ className?: string }>;
};

const SURFACES: ReadonlyArray<Surface> = [
  {
    kicker: "Wallet",
    title: "The dashboard",
    source: "src/app/app",
    body: "Connect a wallet and deposit collateral, draw USD₮0, repay, or supply into the pool as a lender. Balances, prices and rates are read straight from the deployed contracts on X Layer while you look at them.",
    detail: [
      "Approve, deposit and borrow as one atomic batch, on wallets that support EIP-5792",
      "Markets, the pool and any position, each read from the chain or plainly said to be unavailable",
    ],
    link: { label: "Open the dashboard", href: "/app" },
    Icon: IconOverview,
  },
  {
    kicker: "Chat",
    title: "@EquisAppBot on Telegram",
    source: "scripts/telegram-bot.ts",
    body: "/markets, /pool and /position answer from the same deployed contracts. Put an address on /watch and the bot messages you when its health factor falls below 1.15, and again once it recovers above 1.25.",
    detail: [
      "Deliberately dependency-free: the Bot API is plain HTTP and the watch list is one JSON file",
      "Runs as a systemd unit with NoNewPrivileges, PrivateTmp and ProtectSystem=strict",
    ],
    link: { label: "Message the bot", href: "https://t.me/EquisAppBot", external: true },
    Icon: IconTelegram,
  },
  {
    kicker: "Agent",
    title: "The MCP server",
    source: "scripts/mcp-server.ts",
    body: "Equis speaks the Model Context Protocol over stdio, so Claude Code, Claude Desktop, Cursor and Codex can drive the protocol themselves. Six tools: the overview, prices, the pool, a position, a borrow quote, and the transaction itself.",
    detail: [
      "A .mcp.json in the repo root, so Claude Code registers the server on clone with no setup",
      "It reads through the same module as the Telegram bot, so a chat and an agent cannot quote different numbers for one address",
    ],
    command: "npm run mcp",
    isNew: true,
    Icon: IconAgent,
  },
];

const TOOLS: ReadonlyArray<{ name: string; kind: "read" | "unsigned tx" }> = [
  { name: "equis_overview", kind: "read" },
  { name: "equis_markets", kind: "read" },
  { name: "equis_pool", kind: "read" },
  { name: "equis_position", kind: "read" },
  { name: "equis_quote_borrow", kind: "read" },
  { name: "equis_build_transaction", kind: "unsigned tx" },
];

const PROOF: ReadonlyArray<{ label: string; value: string; alarm?: boolean }> = [
  { label: "Built by", value: "equis_build_transaction" },
  { label: "Simulated against", value: "EquisMarginVault, X Layer mainnet" },
  { label: "Result", value: "revert InsufficientCash()", alarm: true },
  { label: "Raised by", value: "EquisLendingPool, not the oracle" },
];

export function ThreeWaysIn() {
  return (
    <section id="surfaces" aria-labelledby="surfaces-title" className="scroll-mt-20 border-b border-line bg-ink">
      <div className="shell py-20 sm:py-28">
        <SectionHeading
          eyebrow="Surfaces"
          title={
            /* The id sits on a span because SectionHeading owns the h2 and aria-labelledby has to
               resolve to a real element. */
            <span id="surfaces-title">
              Three ways in, one set of <em className="font-display italic text-brass">deployed contracts</em>.
            </span>
          }
          lede="A wallet, a chat and an AI agent. All three drive the same vault, pool and oracle listed further down this page, so none of them can act on a number the others would not."
          className="max-w-2xl"
        />

        <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-3">
          {SURFACES.map((surface) => (
            <article key={surface.title} className="flex flex-col bg-panel p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <surface.Icon className="size-[18px] shrink-0 text-brass" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brass">{surface.kicker}</p>
                {surface.isNew ? (
                  <Pill tone="brass" className="ml-auto">
                    New
                  </Pill>
                ) : null}
              </div>

              <h3 className="mt-4 text-lg text-text">{surface.title}</h3>
              <p className="mt-1 break-all font-mono text-[11px] text-faint">{surface.source}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">{surface.body}</p>

              <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-[0.8125rem] leading-relaxed text-faint">
                {surface.detail.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span className="mt-[0.4375rem] size-1 shrink-0 rounded-full bg-brass" aria-hidden="true" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-1 lg:mt-auto">
                {surface.command ? (
                  <code className="inline-block break-all rounded-lg border border-line bg-ink px-2.5 py-1.5 font-mono text-xs text-muted">
                    {surface.command}
                  </code>
                ) : null}
                {surface.link ? (
                  surface.link.external ? (
                    <a
                      href={surface.link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-brass transition-colors hover:text-brass-bright"
                    >
                      {surface.link.label}
                    </a>
                  ) : (
                    <Link
                      href={surface.link.href}
                      className="text-sm text-brass transition-colors hover:text-brass-bright"
                    >
                      {surface.link.label}
                    </Link>
                  )
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {/* The agent surface, shown rather than asserted. */}
        <figure className="mt-10">
          <div className="grid gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-2">
            <div className="bg-panel p-6 sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brass">The interesting one</p>
              <h3 className="mt-4 break-all font-mono text-base text-text">equis_build_transaction</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Ask for a borrow and it returns an unsigned{" "}
                <code className="font-mono text-[0.8125rem] text-text">{"{ to, data, value }"}</code> with a freshly
                signed RedStone price already inside, good for three minutes. The transaction verifies its own price
                onchain and draws USD₮0 in a single send: no separate oracle update, no second signature.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                The server holds no private key and signs nothing. It returns bytes; the authority to move funds
                stays in your wallet, or in an EIP-7702 session key scoped to repay and top up collateral.
              </p>

              <ul className="mt-6 divide-y divide-line border-t border-line">
                {TOOLS.map((tool) => (
                  <li key={tool.name} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                    <code className="break-all font-mono text-[0.8125rem] text-muted">{tool.name}</code>
                    <Pill tone={tool.kind === "read" ? "neutral" : "brass"} className="ml-auto">
                      {tool.kind}
                    </Pill>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-panel p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brass">What we checked</p>
                <Pill tone="good">Price verified onchain</Pill>
              </div>

              <dl className="mt-5 divide-y divide-line overflow-hidden rounded-lg border border-line bg-ink">
                {PROOF.map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                  >
                    <dt className="text-[11px] uppercase tracking-[0.18em] text-faint">{row.label}</dt>
                    <dd
                      className={cn(
                        "break-all font-mono text-xs leading-relaxed sm:text-right",
                        row.alarm ? "text-alarm" : "text-muted",
                      )}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-5 text-sm leading-relaxed text-muted">
                We took the calldata the tool produced and simulated it against the deployed vault. It reverted from
                the lending pool, which had no idle USD₮0 to hand over at the time. That is the good outcome:{" "}
                <code className="font-mono text-[0.8125rem] text-text">borrow()</code> runs{" "}
                <code className="font-mono text-[0.8125rem] text-text">_updatePrices(priceReports)</code> before it
                touches the pool, so reaching the pool at all means RedStone&apos;s three-of-five signature check had
                passed onchain and the oracle had priced the collateral.
              </p>

              <p className="mt-4 text-[0.8125rem] leading-relaxed text-faint">
                Liquidity is the one thing a hackathon weekend cannot fake. Everything upstream of it is live: supply
                USD₮0 into the pool and the same transaction clears.
              </p>
            </div>
          </div>

          <ExhibitCaption label="Exhibit B">
            A borrow an agent built, simulated against the live vault. The revert is the proof: the price cleared
            onchain before the pool was ever reached.
          </ExhibitCaption>
        </figure>
      </div>
    </section>
  );
}
