import type { ReactNode } from "react";
import { Sidebar } from "@/components/app/Sidebar";

/** Chrome for every /app route: the rail on the left, the page beside it. */
export function AppShell({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ink lg:flex">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
          <header className="mb-7">
            <h1 className="text-2xl text-text">{title}</h1>
            {lede ? <p className="mt-2 max-w-2xl text-sm text-muted">{lede}</p> : null}
          </header>
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-5xl px-4 py-5 text-[11px] text-faint sm:px-8">
            xStocks collateral · USD₮0 credit · EIP-7702 session keys · X Layer chain 196
          </div>
        </footer>
      </div>
    </div>
  );
}
