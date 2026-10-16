#!/usr/bin/env node
/**
 * AI gateway guard (docs/architecture/ai-platform.md). Every model call must go
 * through src/lib/server/ai/ (client → transport), which owns timeouts, retries,
 * key handling, the kill switch, daily caps and usage metering. Fails when:
 *
 *  1. an AI provider host appears outside src/lib/server/ai/transport.ts, or
 *  2. an API key is put in a URL query string (`?key=${…}` / `&key=${…}`).
 *
 * Tests (`*.test.ts`, `*.spec.ts`) are skipped — they may hold provider fixtures.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");
const TRANSPORT = join(SRC, "lib", "server", "ai", "transport.ts");

const PROVIDER_HOSTS = [
  "generativelanguage.googleapis.com",
  "api.groq.com",
  "api.openai.com",
  "api.anthropic.com",
  "openrouter.ai",
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path, out);
    } else if (
      /\.(ts|js|svelte)$/.test(entry.name) &&
      !/\.(test|spec)\.ts$/.test(entry.name)
    ) {
      out.push(path);
    }
  }
  return out;
}

const failures = [];
for (const file of walk(SRC)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const where = `${relative(ROOT, file)}:${i + 1}`;
    if (
      file !== TRANSPORT &&
      PROVIDER_HOSTS.some((host) => line.includes(host))
    ) {
      failures.push(
        `${where}  provider host outside src/lib/server/ai/transport.ts — use generateStructured()`,
      );
    }
    if (/[?&]key=\$\{/.test(line)) {
      failures.push(
        `${where}  API key in a URL query string — send it in a header`,
      );
    }
  });
}

if (failures.length > 0) {
  console.error("check-ai-gateway: violations\n" + failures.join("\n"));
  process.exit(1);
}
console.log("check-ai-gateway: OK");
