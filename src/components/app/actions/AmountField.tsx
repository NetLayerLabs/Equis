"use client";

import { formatUnits } from "viem";

/** Amount input with the wallet's own maximum beside it, so nobody has to type a balance by hand. */
export function AmountField({
  label,
  value,
  onChange,
  max,
  decimals,
  symbol,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max?: bigint;
  decimals: number;
  symbol: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2 text-[11px] uppercase tracking-[0.18em] text-faint">
        {label}
        {max !== undefined && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(formatUnits(max, decimals))}
            className="font-mono text-[11px] normal-case tracking-normal text-muted transition-colors hover:text-brass disabled:opacity-50"
          >
            max {Number(formatUnits(max, decimals)).toLocaleString("en-US", { maximumFractionDigits: 6 })}
          </button>
        )}
      </span>
      <span className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-ink px-3 py-2 focus-within:border-brass/50">
        <input
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "" || /^\d*\.?\d*$/.test(next)) onChange(next);
          }}
          className="w-full bg-transparent font-mono text-lg tabular-nums text-text outline-none placeholder:text-faint disabled:opacity-50"
        />
        <span className="shrink-0 font-mono text-xs text-muted">{symbol}</span>
      </span>
    </label>
  );
}
