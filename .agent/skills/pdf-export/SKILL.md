# PDF export — server-only @react-pdf/renderer

**Intentional exception:** SvelteKit app keeps `@react-pdf/renderer` as a **server-only** dependency for byte-identical loan/investor/transaction PDFs.

## Rule

- PDF code runs only in `+server.ts` routes or `+page.server.ts` actions via `renderToBuffer` / `renderToStream`.
- **Never** import `@react-pdf/renderer` or React PDF components into `.svelte` files or client bundles.
- `react` and `react-dom` stay dev/server dependencies for PDF rendering only.

## Legacy reference

- `components/pdf/*` — React PDF document components.
- `lib/pdf-export.ts`, `lib/pdf-sections.ts` — export helpers.
- Loan contracts: `components/pdf/loans-pdf-document.tsx`, `loan-contract-document-body.tsx`.

## SvelteKit target

- Move PDF modules to `src/lib/server/pdf/` (or similar).
- Download endpoints: `src/routes/api/.../+server.ts` return `application/pdf` responses.
- Port components with minimal changes; do not rewrite layouts in a new PDF engine.

## Do not "fix"

Agents must not remove React from PDF paths to "align with SvelteKit" — that breaks contract parity. Stack guard allows React only here.
