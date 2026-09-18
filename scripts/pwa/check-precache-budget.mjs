import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const CLIENT_DIR = join(ROOT, ".svelte-kit/output/client");
const BUDGET = JSON.parse(
  readFileSync(join(import.meta.dirname, "precache-budget.json"), "utf8"),
).budgetKiB;

function walk(dir) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) total += walk(path);
    else total += stat.size;
  }
  return total;
}

const staticDir = join(ROOT, "static");
const clientBytes = walk(CLIENT_DIR);
const staticBytes = walk(staticDir);
const totalKiB = Math.ceil((clientBytes + staticBytes) / 1024);

if (totalKiB > BUDGET) {
  console.error(
    `Precache budget exceeded: ${totalKiB} KiB > ${BUDGET} KiB (client + static)`,
  );
  process.exit(1);
}

console.log(`Precache budget OK: ${totalKiB} KiB / ${BUDGET} KiB`);
