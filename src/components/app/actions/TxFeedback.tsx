"use client";

import { OKX_TX_URL } from "@/lib/contracts";
import { Pill } from "@/components/ui";

/** One consistent place for pending / failed / confirmed, with the hash always linked to the explorer. */
export function TxFeedback({
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
}: {
  hash?: `0x${string}`;
  isPending?: boolean;
  isConfirming?: boolean;
  isSuccess?: boolean;
  error?: Error | null;
}) {
  if (error) {
    const message = error.message.split("\n")[0];
    return <p className="mt-3 text-[11px] leading-relaxed text-alarm">{message}</p>;
  }
  if (!hash && !isPending) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted">
      {isPending && <Pill>Confirm in wallet</Pill>}
      {isConfirming && <Pill tone="brass">Confirming onchain</Pill>}
      {isSuccess && <Pill tone="good">Confirmed</Pill>}
      {hash && (
        <a href={`${OKX_TX_URL}${hash}`} target="_blank" rel="noreferrer" className="font-mono hover:text-brass">
          {hash.slice(0, 10)}…{hash.slice(-6)}
        </a>
      )}
    </div>
  );
}
