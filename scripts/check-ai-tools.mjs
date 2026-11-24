#!/usr/bin/env node
/**
 * Read-only tool guard. v1 has no write tools, and tools must not reach the
 * database, the network, the filesystem, or env directly. They compose data
 * through `src/lib/server/assistant/viewer-data.ts` and the money engine.
 *
 * Fails when a file under `src/lib/server/ai/tools/` contains a write, a direct
 * DB import, fetch, fs, child_process, process.env, or a non-read capability.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const TOOLS = join(ROOT, "src", "lib", "server", "ai", "tools");

const FORBIDDEN = [
  { pattern: /from\s+["']\$lib\/server\/db["']/, reason: "direct DB import" },
  {
    pattern: /from\s+["']\$lib\/server\/db\/schema["']/,
    reason: "direct DB schema import",
  },
  {
    pattern: /\bdb\.(insert|update|delete|execute|transaction)\b/,
    reason: "DB write",
  },
  { pattern: /\.insert\(|\.update\(|\.delete\(/, reason: "DB write" },
  { pattern: /\bfetch\s*\(/, reason: "network call" },
  {
    pattern:
      /from\s+["']node:(fs|net|http|https|child_process|worker_threads)["']/,
    reason: "forbidden node module",
  },
  { pattern: /\bprocess\.env\b/, reason: "env access" },
  {
    pattern: /capability:\s*["'](propose|write)["']/,
    reason: "non-read capability",
  },
  {
    pattern: /method:\s*["'](POST|PUT|PATCH|DELETE)["']/,
    reason: "mutating HTTP method",
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.ts$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name))
      out.push(path);
  }
  return out;
}

const failures = [];
for (const file of walk(TOOLS)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(line)) {
        failures.push(
          `${relative(ROOT, file)}:${index + 1}  ${rule.reason} — tools are read-only; use viewer-data or the money engine`,
        );
      }
    }
  });
}

if (failures.length > 0) {
  console.error(
    `check-ai-tools: ${failures.length} violation(s)\n${failures.join("\n")}`,
  );
  process.exit(1);
}
console.log(`check-ai-tools: OK (${walk(TOOLS).length} files)`);
