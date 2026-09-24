"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { IconClose, IconMenu } from "@/components/icons";
import { buttonClass } from "@/components/ui";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#design", label: "Architecture" },
  { href: "#surfaces", label: "Three ways in" },
  { href: "#verified", label: "Verified onchain" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  // Escape closes the menu, and the page behind it must not scroll while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-ink/85 backdrop-blur">
      <nav className="shell-nav flex items-center justify-between gap-4 py-3 sm:py-4">
        <Link href="/" aria-label="Equis home">
          {/* Smaller on a phone, where the header shares the row with the menu button. */}
          <Logo markClassName="h-9 w-auto md:h-[3.375rem]" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-muted transition-colors hover:text-text">
              {link.label}
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="landing-menu"
          className="-mr-1 p-2 text-muted transition-colors hover:text-text md:hidden"
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </nav>

      {open && (
        <div id="landing-menu" className="border-t border-line bg-ink md:hidden">
          <div className="shell-nav flex flex-col py-2">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/60 py-3.5 text-sm text-muted transition-colors last:border-0 hover:text-text"
              >
                {link.label}
              </a>
            ))}
            <Link href="/app" onClick={() => setOpen(false)} className={buttonClass("primary", "md", "my-3")}>
              Open dashboard
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
