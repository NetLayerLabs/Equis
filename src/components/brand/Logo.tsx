import Image from "next/image";
import { cn } from "@/lib/cn";

/*
 * The Equis identity. Both files carry a near-black ground that matches the app's own surface, so they sit
 * flush on any panel without a visible plate.
 *   header  the full lockup, used in the landing nav, the footer and the expanded sidebar
 *   mark    the square symbol, used where the lockup will not fit (collapsed rail, favicon)
 */
export function EquisMark({ className }: { className?: string }) {
  return (
    <Image
      src="/equis-mark.png"
      alt=""
      width={512}
      height={512}
      aria-hidden="true"
      className={cn("size-8 rounded-lg", className)}
    />
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/equis-header.png"
        alt="Equis"
        width={900}
        height={225}
        priority
        className={cn("h-9 w-auto", markClassName)}
      />
    </span>
  );
}
