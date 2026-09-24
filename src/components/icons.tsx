type IconProps = { className?: string };

const base = "size-[18px] shrink-0";

/** One stroke weight, one grid: the app's whole icon set. */
export function IconOverview({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? base} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function IconMarkets({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? base} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 20h18" strokeLinecap="round" />
      <path d="M6 20v-6M11 20V8M16 20v-9M21 20V5" strokeLinecap="round" />
    </svg>
  );
}

export function IconEarn({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? base} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <ellipse cx="12" cy="6.5" rx="7" ry="3" />
      <path d="M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </svg>
  );
}

export function IconAgent({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? base} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8.5" cy="12" r="4.5" />
      <path d="M13 12h8M17.5 12v3.5M20.5 12v2.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "size-4 shrink-0"} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M14.5 5 8 12l6.5 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMenu({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "size-5 shrink-0"} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "size-5 shrink-0"} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
