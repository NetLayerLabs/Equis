import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const COLUMNS: ReadonlyArray<{ heading: string; links: ReadonlyArray<{ label: string; href: string }> }> = [
  {
    heading: "Product",
    links: [
      { label: "Open dashboard", href: "/app" },
      { label: "Collateral markets", href: "/app/markets" },
      { label: "Agent keys", href: "/app/agent" },
    ],
  },
  {
    heading: "Protocol",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Architecture", href: "/#design" },
      { label: "Verified addresses", href: "/#verified" },
    ],
  },
  {
    heading: "Project",
    links: [
      { label: "X Layer explorer", href: "https://www.oklink.com/x-layer" },
      { label: "xStocks", href: "https://xstocks.com" },
      { label: "Chainlink Data Streams", href: "https://docs.chain.link/data-streams" },
    ],
  },
];

export function Footer() {
  return (
    <footer id="footer" className="border-t border-line bg-ink-deep">
      <div className="shell py-16">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:gap-8">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-faint">
              Margin credit against tokenized stocks on X Layer. Built for OKX Dev Day 2026 · Apache-2.0 ·
              unaudited, with deliberately small caps.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-faint">{column.heading}</h2>
              <ul className="mt-5 space-y-3.5">
                {column.links.map((link) => {
                  const external = link.href.startsWith("http");
                  return (
                    <li key={link.label}>
                      {external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-muted transition-colors hover:text-text"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="text-sm text-muted transition-colors hover:text-text">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
