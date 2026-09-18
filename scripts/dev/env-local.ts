import { readFileSync } from "node:fs";
import { parse } from "dotenv";

/** Mirrors `scripts/db/resolve-database-url.sh` targets. */
export type ScriptDatabaseTarget = "app" | "prod" | "vercel";

/**
 * Env for standalone Bun scripts. Values in `.env.local` win over `process.env`
 * so Bun's partial inject (e.g. empty strings) does not clobber secrets.
 */
export function envForScript(
  path = ".env.local",
): Record<string, string | undefined> {
  let fromFile: Record<string, string> = {};
  try {
    fromFile = parse(readFileSync(path, "utf8")) as Record<string, string>;
  } catch {
    /* missing file */
  }
  return { ...process.env, ...fromFile };
}

function isPlaceholderDatabaseUrl(url: string | undefined): boolean {
  if (!url?.trim()) return true;
  return url.includes("...") || url.includes("<") || url.includes("…");
}

export function databaseUrlHostLabel(url: string): string {
  if (/127\.0\.0\.1|localhost/.test(url)) {
    return "local Docker Postgres (127.0.0.1:5433)";
  }
  if (url.includes("ap-southeast-1")) {
    return "Neon Singapore (DATABASE_URL_PROD)";
  }
  if (url.includes("us-east-1")) {
    return "Neon US East 1 (DATABASE_URL_VERCEL)";
  }
  if (url.includes("neon.tech")) return "Neon hosted Postgres";
  return "Postgres";
}

/** Resolve DATABASE_URL / DATABASE_URL_PROD / DATABASE_URL_VERCEL from script env. */
export function resolveScriptDatabaseUrl(
  env: Record<string, string | undefined>,
  target: ScriptDatabaseTarget = "app",
): string {
  let url: string | undefined;
  switch (target) {
    case "prod":
      url = env.DATABASE_URL_PROD;
      break;
    case "vercel":
      url = env.DATABASE_URL_VERCEL;
      if (isPlaceholderDatabaseUrl(url)) {
        throw new Error(
          "Set DATABASE_URL_VERCEL in .env.local (same Neon URL as Vercel production).",
        );
      }
      break;
    case "app":
      url = env.DATABASE_URL;
      break;
  }

  url = url?.trim();
  if (isPlaceholderDatabaseUrl(url)) {
    const hint =
      target === "prod"
        ? "Set DATABASE_URL_PROD in .env.local."
        : target === "vercel"
          ? "Set DATABASE_URL_VERCEL in .env.local."
          : "Set DATABASE_URL in .env.local.";
    throw new Error(`No database URL for --db=${target}. ${hint}`);
  }
  return url;
}

export function parseScriptDatabaseTarget(
  argv = process.argv,
): ScriptDatabaseTarget {
  const arg = argv.find((a) => a.startsWith("--db="));
  if (!arg) return "app";
  const value = arg.split("=")[1];
  if (value === "app" || value === "prod" || value === "vercel") {
    return value;
  }
  throw new Error("--db must be app, prod, or vercel");
}
