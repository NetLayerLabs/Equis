import { cn } from "@/lib/cn";

/*
 * The Equis mark: an engraved seal whose three rules are the protocol's ledger - collateral above,
 * credit below, the brass line between them the loan. Drawn, not an image file, so it stays crisp
 * at any size and needs no asset pipeline.
 */
export function EquisMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4.5" y="4.5" width="31" height="31" rx="6.5" stroke="currentColor" strokeOpacity="0.35" />
      <path d="M12 14.5h16M12 20h11" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      <path d="M12 25.5h16" stroke="#C9A227" strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <EquisMark className={cn("size-8 text-text", markClassName)} />
      <span className="font-display text-[1.35rem] leading-none tracking-[0.14em] text-text">EQUIS</span>
    </span>
  );
}
