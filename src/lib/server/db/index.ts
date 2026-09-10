import { readFileSync } from "node:fs";
import { config, parse } from "dotenv";
import { env } from "$env/dynamic/private";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { Pool, neonConfig } from "@neondatabase/serverless";
import postgres from "postgres";
import ws from "ws";
import * as schema from "./schema";

if (!env.DATABASE_URL) {
  config({ path: ".env.local" });
}

export const LOCAL_DATABASE_URL =
  "postgresql://kame_lends:kame_lends@127.0.0.1:5433/kame_lends";

const BUILD_DATABASE_URL = "postgresql://build:build@127.0.0.1:5432/build";

/** `.env.example` values ("…@ep-....us-east-1…") exported into a shell connect to nothing. */
export function isPlaceholderDatabaseUrl(
  url: string | undefined | null,
): boolean {
  if (!url) return true;
  return url.includes("...") || url.includes("<") || url.includes("…");
}

function databaseUrlFromEnvLocal(): string | undefined {
  try {
    return parse(readFileSync(".env.local", "utf8")).DATABASE_URL;
  } catch {
    return undefined;
  }
}

function resolveConnectionString(): string {
  const exported = env.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!isPlaceholderDatabaseUrl(exported)) return exported as string;

  const fromFile = databaseUrlFromEnvLocal();
  if (!isPlaceholderDatabaseUrl(fromFile)) {
    if (exported) {
      console.warn(
        "[db] Ignoring placeholder DATABASE_URL from the environment; using .env.local. Run `unset DATABASE_URL` in that shell.",
      );
    }
    return fromFile as string;
  }

  if (exported) {
    throw new Error(
      "DATABASE_URL is a placeholder (copied from .env.example). Unset it or set a real connection string.",
    );
  }
  return BUILD_DATABASE_URL;
}

const connectionString = resolveConnectionString();

export function isLocalDatabase(url: string): boolean {
  return /(?:localhost|127\.0\.0\.1)/.test(url);
}

type DbCache = {
  connectionString: string;
  db: ReturnType<typeof createDb>;
};

const globalForDb = globalThis as typeof globalThis & {
  __kameLendsDb?: DbCache;
};

function createDb(url: string) {
  if (isLocalDatabase(url)) {
    const client = postgres(url, { max: 10 });
    return drizzlePostgres(client, { schema });
  }

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url, max: 10 });
  return drizzleNeon(pool, { schema });
}

function getDb() {
  const cached = globalForDb.__kameLendsDb;
  if (cached && cached.connectionString === connectionString) {
    return cached.db;
  }

  const next = {
    connectionString,
    db: createDb(connectionString),
  };
  globalForDb.__kameLendsDb = next;
  return next.db;
}

export const db = getDb();
