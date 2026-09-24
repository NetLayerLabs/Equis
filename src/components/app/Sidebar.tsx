"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { EquisMark, Logo } from "@/components/brand/Logo";
import {
  IconAgent,
  IconChevronLeft,
  IconClose,
  IconEarn,
  IconMarkets,
  IconMenu,
  IconOverview,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { WalletCard } from "./WalletCard";

const NAV: ReadonlyArray<{ href: string; label: string; Icon: ComponentType<{ className?: string }> }> = [
  { href: "/app", label: "Overview", Icon: IconOverview },
  { href: "/app/markets", label: "Markets", Icon: IconMarkets },
  { href: "/app/earn", label: "Earn", Icon: IconEarn },
  { href: "/app/agent", label: "Agent keys", Icon: IconAgent },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Escape closes the drawer, and the page behind it must not scroll while it is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const nav = (
    <nav className="mt-6 flex flex-col gap-1">
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            onClick={() => setDrawerOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active ? "bg-brass/10 text-brass" : "text-muted hover:bg-panel-soft hover:text-text",
              collapsed && "justify-center px-0",
            )}
          >
            {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brass" aria-hidden="true" />}
            <Icon />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const panel = (inDrawer: boolean) => (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" aria-label="Equis home" className="min-w-0">
          {collapsed && !inDrawer ? (
            <EquisMark className="size-8 text-text" />
          ) : (
            <span className="flex flex-col gap-1.5">
              <Logo markClassName="h-8" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-faint">Margin credit</span>
            </span>
          )}
        </Link>
        {inDrawer ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="text-faint transition-colors hover:text-text"
          >
            <IconClose />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn("text-faint transition-colors hover:text-text", collapsed && "hidden")}
          >
            <IconChevronLeft />
          </button>
        )}
      </div>

      {nav}
      <div className="flex-1" />
      {(!collapsed || inDrawer) && <WalletCard />}
    </div>
  );

  return (
    <>
      {/* Mobile: a bar with a burger, and the same panel in a drawer behind it. */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-ink/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" aria-label="Equis home">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          className="text-muted transition-colors hover:text-text"
        >
          <IconMenu />
        </button>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-deep/80 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] border-r border-line bg-panel">
            {panel(true)}
          </aside>
        </div>
      )}

      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-line bg-panel/60 transition-[width] lg:block",
          collapsed ? "w-[5.5rem]" : "w-64",
        )}
      >
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="absolute right-3 top-6 rotate-180 text-faint transition-colors hover:text-text"
          >
            <IconChevronLeft />
          </button>
        )}
        {panel(false)}
      </aside>
    </>
  );
}
