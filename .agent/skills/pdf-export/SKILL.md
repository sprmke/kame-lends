# PDF export — server-only @react-pdf/renderer

**Intentional exception:** SvelteKit keeps `@react-pdf/renderer` as a **server-only** dependency for loan, investor, transaction, and contract PDFs.

## Rule

- PDF code runs only in `+server.ts` routes or `+page.server.ts` actions via `renderToBuffer` / `renderToStream`.
- **Never** import `@react-pdf/renderer` or React PDF components into `.svelte` files or client bundles.
- `react` and `react-dom` stay as dependencies for PDF rendering only.

## Where it lives

- Documents: `src/lib/server/pdf/*.tsx`
- Render helper: `src/lib/server/pdf/render.ts`
- Download endpoints: `src/routes/api/**/+server.ts` return `application/pdf`

## Do not "fix"

Agents must not remove React from PDF paths to "align with SvelteKit". Stack guard allows React only here.

## Vercel deploy gotcha: pdfkit standard fonts

Core fonts (Helvetica family) load through `pdfkit`'s `#standard-fonts/*.cjs` import. Those files also `require('./chunks/standardGlyphNames-*.cjs')`. `@vercel/nft` misses both the dynamic font import and the `.cjs` chunk (it keeps the `.mjs` twin). `scripts/deploy/copy-pdfkit-standard-fonts.mjs` copies the whole `js/standard-fonts` tree into every traced function bundle after `vite build` and **fails the build** if `require('#standard-fonts/Helvetica')` does not load. A check that only confirms `Helvetica.cjs` exists is not a fix. Never skip or bypass this script. If a PDF route 500s in production only, this is the first thing to check (`docs/architecture/deployment.md#pdf-generation-pdfkit-standard-fonts`). Any change to `svelte.config.js`'s adapter config or to which routes render PDFs should be followed by `rm -rf .vercel/output && bun run build` to confirm the script still finds and loads fonts in every bundle.
