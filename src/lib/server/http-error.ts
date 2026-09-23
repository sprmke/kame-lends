export function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

/** Client-safe JSON error. Internal details stay off production responses. */
export function publicJsonError(
  error: string,
  details?: unknown,
): { error: string; details?: string } {
  if (isProductionRuntime() || details == null) {
    return { error };
  }
  const text =
    details instanceof Error ? details.message : String(details ?? "");
  return text ? { error, details: text } : { error };
}
