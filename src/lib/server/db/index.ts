import { config } from "dotenv";
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

const connectionString =
  env.DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://build:build@127.0.0.1:5432/build";

export function isLocalDatabase(url: string): boolean {
  return /(?:localhost|127\.0\.0\.1)/.test(url);
}

function createDb() {
  if (isLocalDatabase(connectionString)) {
    const client = postgres(connectionString, { max: 10 });
    return drizzlePostgres(client, { schema });
  }

  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString, max: 10 });
  return drizzleNeon(pool, { schema });
}

export const db = createDb();
