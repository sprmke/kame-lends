#!/usr/bin/env node
/**
 * pdfkit loads its base-14 standard font metrics via
 * `createRequire(...)('#standard-fonts/Helvetica.afm')`, which resolves through
 * package.json `imports` to `js/standard-fonts/*.cjs`. `@vercel/nft` (used by
 * `@sveltejs/adapter-vercel` to trace each function's `node_modules`) performs
 * static analysis and cannot follow that dynamic subpath import, so the `.cjs`
 * files are silently dropped from the deployed bundle. Every PDF route that
 * renders text with a core font (Helvetica, Helvetica-Bold, ...) then throws
 * `Cannot find module '.../pdfkit/js/standard-fonts/Helvetica.cjs'` in
 * production, even though `bun run test` and local dev never touch this path.
 *
 * Fix: after `vite build` writes `.vercel/output/functions/**\/*.func`, copy the
 * missing `.cjs` files into every traced `pdfkit` tree, then verify every tree
 * actually has all of them. If verification fails, exit non-zero so the build
 * (and therefore the deploy) fails loudly instead of shipping a broken PDF
 * feature — this exact regression has shipped silently more than once.
 *
 * See docs/architecture/deployment.md and docs/PROJECT.md.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const outputRoot = path.join(root, ".vercel/output/functions");
const projectPdfkitDir = path.join(root, "node_modules/pdfkit");
const sourceDir = path.join(projectPdfkitDir, "js/standard-fonts");

function fail(message) {
  console.error(`copy-pdfkit-standard-fonts: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(outputRoot)) {
  // No Vercel Build Output yet (e.g. plain `vite build` without the adapter
  // having run, or a non-Vercel target). Nothing to patch.
  process.exit(0);
}

// pdfkit is a real dependency of @react-pdf/font / @react-pdf/render. If it is
// not installed at all, something is wrong with the install — fail loudly
// rather than silently shipping PDF routes that will 500 in production.
if (!fs.existsSync(projectPdfkitDir)) {
  fail(
    "node_modules/pdfkit not found. @react-pdf/renderer's PDF routes require it; check the lockfile/install.",
  );
}

if (!fs.existsSync(sourceDir)) {
  fail(
    `${path.relative(root, sourceDir)} not found. pdfkit's standard-fonts layout may have changed; update this script.`,
  );
}

const cjsFonts = fs
  .readdirSync(sourceDir)
  .filter((name) => name.endsWith(".cjs"));
if (cjsFonts.length === 0) {
  fail(
    `no .cjs font files in ${path.relative(root, sourceDir)}. pdfkit's standard-fonts format may have changed; update this script.`,
  );
}

/** Recursively find every directory named `pdfkit` that sits under a `node_modules` parent. */
function findPdfkitDirs(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === "pdfkit" && path.basename(dir) === "node_modules") {
      out.push(full);
      // pdfkit has no further nested node_modules of its own; no need to recurse in.
      continue;
    }
    findPdfkitDirs(full, out);
  }
}

/** Every deployable `.func` bundle under the Build Output. */
function findFuncDirs(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.endsWith(".func")) {
      out.push(full);
    } else {
      findFuncDirs(full, out);
    }
  }
}

const funcDirs = [];
findFuncDirs(outputRoot, funcDirs);

const pdfkitDirs = [];
for (const funcDir of funcDirs) {
  findPdfkitDirs(funcDir, pdfkitDirs);
}

if (pdfkitDirs.length === 0) {
  // No function bundle actually traced pdfkit (e.g. PDF routes were removed).
  // Nothing to do — do not fail the build over a dependency that isn't shipped.
  console.log(
    "copy-pdfkit-standard-fonts: no function bundle references pdfkit, skipping",
  );
  process.exit(0);
}

for (const pdfkitDir of pdfkitDirs) {
  const targetDir = path.join(pdfkitDir, "js/standard-fonts");
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of cjsFonts) {
    fs.copyFileSync(path.join(sourceDir, file), path.join(targetDir, file));
  }
}

// Hard gate: confirm every traced pdfkit tree really has every font file now.
// If this ever fails, the build fails instead of shipping a route that 500s
// the first time a user downloads a PDF.
const missing = [];
for (const pdfkitDir of pdfkitDirs) {
  const targetDir = path.join(pdfkitDir, "js/standard-fonts");
  for (const file of cjsFonts) {
    if (!fs.existsSync(path.join(targetDir, file))) {
      missing.push(path.relative(root, path.join(targetDir, file)));
    }
  }
}

if (missing.length > 0) {
  fail(
    `verification failed, still missing after copy:\n  ${missing.join("\n  ")}`,
  );
}

console.log(
  `copy-pdfkit-standard-fonts: verified ${cjsFonts.length} font file(s) in ${pdfkitDirs.length} pdfkit bundle(s) (${funcDirs.length} function(s) scanned)`,
);
