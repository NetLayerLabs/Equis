import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Equis UI primitives. Pages compose these instead of restyling raw elements, so the dashboard and
 * the landing page stay one product.
 */

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants = {
  primary: "bg-brass text-ink-deep hover:bg-brass-bright",
  secondary: "border border-line-strong bg-panel text-text hover:border-brass/60 hover:text-brass",
  ghost: "text-muted hover:bg-panel-soft hover:text-text",
} as const;

const buttonSizes = {
  sm: "h-8 rounded-lg px-3 text-sm",
  md: "h-10 rounded-lg px-4 text-sm",
  lg: "h-12 rounded-xl px-6 text-[0.95rem]",
} as const;

type ButtonVariant = keyof typeof buttonVariants;
type ButtonSize = keyof typeof buttonSizes;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <a className={buttonClass(variant, size, className)} {...rest} />;
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-panel shadow-card", className)} {...rest} />;
}

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "good" | "bad" | "brass";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-white/5 text-muted",
    good: "bg-signal/10 text-signal",
    bad: "bg-alarm/10 text-alarm",
    brass: "bg-brass/10 text-brass",
  } as const;
  return (
    <span className={cn("whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>
  );
}

/** A label/value pair with the value set in tabular figures - the app's basic unit of data. */
export function Metric({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[11px] uppercase tracking-[0.18em] text-faint">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-mono text-xl tabular-nums",
          tone === "danger" ? "text-alarm" : "text-text",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="mt-0.5 text-[11px] text-faint">{hint}</dd> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brass">{eyebrow}</p> : null}
      <h2 className="mt-4 text-3xl leading-[1.1] text-text sm:text-4xl">{title}</h2>
      {lede ? <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-muted">{lede}</p> : null}
    </div>
  );
}
