import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#design", label: "Architecture" },
  { href: "#verified", label: "Verified onchain" },
];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-ink/85 backdrop-blur">
      <nav className="shell-nav flex items-center justify-between gap-6 py-4">
        <Link href="/" aria-label="Equis home">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 text-xs sm:gap-8 sm:text-sm">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-muted transition-colors hover:text-text">
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
