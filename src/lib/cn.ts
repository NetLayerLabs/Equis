/** Joins class names, dropping falsy values. Keep conflicting utilities out of the same call. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
