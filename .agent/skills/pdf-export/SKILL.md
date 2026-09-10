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
