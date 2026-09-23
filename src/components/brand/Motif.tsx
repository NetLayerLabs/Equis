import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * The hand-set details that make the page Equis's own: small-caps eyebrows, a brass ledger rule
 * that ends in the seal, engraved guilloché rosettes from the borders of share certificates,
 * and "Exhibit" captions under the product figures.
 */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.28em] text-brass", className)}>{children}</p>
  );
}

/** A hairline that thickens into a brass seam - the loan between collateral and credit. Decorative. */
export function LedgerRule({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center gap-3 text-line-strong", className)}>
      <span className="h-px flex-1 bg-current" />
      <span className="h-px w-16 bg-brass/70" />
      <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-brass" fill="none">
        <rect x="1" y="1" width="22" height="22" rx="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}

/**
 * Guilloché: the interference rosette engraved on banknotes and share certificates, drawn from
 * overlapping ellipses. Purely decorative, and cheap - it is one <svg> with no filters.
 */
export function Guilloche({ className }: { className?: string }) {
  const rings = Array.from({ length: 18 }, (_, i) => i);
  return (
    <svg viewBox="0 0 400 400" className={className} fill="none" aria-hidden="true">
      {rings.map((i) => (
        <ellipse
          key={i}
          cx="200"
          cy="200"
          rx={60 + i * 7}
          ry={150 - i * 5}
          stroke="currentColor"
          strokeWidth="0.6"
          transform={`rotate(${i * 10} 200 200)`}
        />
      ))}
    </svg>
  );
}

/** Large serif numerals for the numbered steps. */
export function Numeral({ n, className }: { n: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("font-display text-4xl leading-none tabular-nums text-brass", className)}>
      {String(n).padStart(2, "0")}
    </span>
  );
}

/** "Exhibit A" captions under the product figures, as in a filing. */
export function ExhibitCaption({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figcaption className="mt-4 flex gap-2 text-[11px] leading-relaxed text-faint">
      <span className="shrink-0 whitespace-nowrap font-display italic text-muted">{label}</span>
      <span>{children}</span>
    </figcaption>
  );
}
