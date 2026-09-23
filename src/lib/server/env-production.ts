const REQUIRED_PRODUCTION = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "CRON_SECRET",
] as const;

let checked = false;

/** Log missing production secrets once per isolate. Does not throw so boot stays diagnosable. */
export function warnMissingProductionEnv(): string[] {
  if (process.env.VERCEL_ENV !== "production") return [];
  if (checked) return [];
  checked = true;
  const missing = REQUIRED_PRODUCTION.filter((name) => {
    const value = process.env[name];
    return !value || value.includes("...") || value.includes("<");
  });
  if (missing.length > 0) {
    console.error("[env] missing production variables:", missing.join(", "));
  }
  return missing;
}
