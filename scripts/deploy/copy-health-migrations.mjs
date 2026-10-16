#!/usr/bin/env node
/**
 * `/api/health` lists `db/migrations` with `readdir` from `process.cwd()`.
 * The Vercel function tracer does not follow that read, so the SQL files never
 * ship and the probe throws instead of returning migration status.
 * Copy them into the health function root, which is the runtime cwd.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const source = path.join(root, "db/migrations");
const dest = path.join(
  root,
  ".vercel/output/functions/api/health.func/db/migrations",
);

const names = fs.readdirSync(source).filter((name) => name.endsWith(".sql"));
fs.mkdirSync(dest, { recursive: true });
for (const name of names) {
  fs.copyFileSync(path.join(source, name), path.join(dest, name));
}

const copied = fs.readdirSync(dest).filter((name) => name.endsWith(".sql"));
if (copied.length !== names.length) {
  console.error(
    `copy-health-migrations: expected ${names.length} sql files, found ${copied.length}`,
  );
  process.exit(1);
}

console.log(
  `copy-health-migrations: ${copied.length} sql file(s) in the health function`,
);
