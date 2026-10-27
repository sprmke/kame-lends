#!/usr/bin/env node
/**
 * pdfkit loads its base-14 standard font metrics via
 * `createRequire(...)('#standard-fonts/Helvetica')`, which resolves through
 * package.json `imports` to `js/standard-fonts/*.cjs`. `@vercel/nft` (used by
 * `@sveltejs/adapter-vercel` to trace each function's `node_modules`) performs
 * static analysis and cannot follow that dynamic subpath import.
 *
 * Copying only the top-level `.cjs` files is not enough. Each of those files
 * does `require('./chunks/standardGlyphNames-*.cjs')`. nft follows the `.mjs`
 * twin of that chunk and drops the `.cjs` twin, so production throws
 * `Cannot find module './chunks/standardGlyphNames-....cjs'` the first time a
 * PDF draws text. Local dev and `bun run test` never see it: they use the full
 * `node_modules/pdfkit` tree. A file-exists check on `Helvetica.cjs` stays
 * green while every production export still 500s.
 *
 * Fix: after `vite build` writes `.vercel/output/functions/**\/*.func`, copy the
 * whole `js/standard-fonts` tree (including `chunks/`) into every traced
 * `pdfkit` directory, then actually `require()` Helvetica and Helvetica-Bold
 * the same way pdfkit does at runtime. If that load fails, exit non-zero so
 * the deploy fails instead of shipping a broken PDF route.
 *
 * See docs/architecture/deployment.md and docs/PROJECT.md.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

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

const chunkDir = path.join(sourceDir, "chunks");
const cjsChunks = fs.existsSync(chunkDir)
  ? fs.readdirSync(chunkDir).filter((name) => name.endsWith(".cjs"))
  : [];
if (cjsChunks.length === 0) {
  fail(
    `no .cjs chunks in ${path.relative(root, chunkDir)}. pdfkit's standard-fonts layout may have changed; update this script.`,
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
  fs.cpSync(sourceDir, targetDir, { recursive: true });
}

// Hard gate: the font module must load, not merely exist on disk. Helvetica.cjs
// require()s a hashed chunk; a missing chunk is the production 500.
const fontSpecifiers = [
  "#standard-fonts/Helvetica",
  "#standard-fonts/HelveticaBold",
];
const loadErrors = [];
for (const pdfkitDir of pdfkitDirs) {
  const entryCandidates = [
    path.join(pdfkitDir, "js/pdfkit.node.mjs"),
    path.join(pdfkitDir, "js/pdfkit.js"),
  ];
  const entry = entryCandidates.find((candidate) => fs.existsSync(candidate));
  if (!entry) {
    loadErrors.push(
      `${path.relative(root, pdfkitDir)} has no pdfkit.js / pdfkit.node.mjs entry`,
    );
    continue;
  }
  const require = createRequire(pathToFileURL(entry));
  for (const specifier of fontSpecifiers) {
    try {
      const font = require(specifier);
      if (!font?.glyphNames || !font?.glyphWidths) {
        loadErrors.push(
          `${specifier} from ${path.relative(root, pdfkitDir)} loaded without glyph metrics`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      loadErrors.push(
        `${specifier} from ${path.relative(root, pdfkitDir)}: ${message}`,
      );
    }
  }
}

if (loadErrors.length > 0) {
  fail(
    `verification failed, standard fonts do not load:\n  ${loadErrors.join("\n  ")}`,
  );
}

console.log(
  `copy-pdfkit-standard-fonts: loaded ${fontSpecifiers.length} font(s) in ${pdfkitDirs.length} pdfkit bundle(s) (${funcDirs.length} function(s) scanned, ${cjsChunks.length} glyph chunk(s) copied)`,
);
