---
name: ai-platform
description: AI gateway for Kame Lends — Gemini/Groq via src/lib/server/ai (generateStructured), prompts, usage log, kill switch, receipt scanning. Use when adding or changing any AI/LLM feature, prompt, model, receipt scan, or AI env var.
---

# AI platform — Kame Lends

Full doc: `docs/architecture/ai-platform.md`.

## Rules

1. **All model calls go through `generateStructured()`** in `src/lib/server/ai/client.ts`. Never `fetch` a provider from feature code. Provider hosts live only in `transport.ts` (`bun run check:ai-gateway` enforces it).
2. **Keys only from env** via `config.ts` (`GEMINI_API_KEYS` / `GEMINI_API_KEY`, `GROQ_API_KEY`). Gemini key in the `x-goog-api-key` header, never in the URL.
3. **Versioned prompts** in `src/lib/server/ai/prompts/` with `definePrompt`. Bump `version` on any prompt or schema change. Include `DOCUMENT_INJECTION_RULE` for images and documents.
4. **Structured output:** Gemini `responseSchema` + zod schema. Coerce field values leniently, but fail on wrong structure so the client's single repair retry can run.
5. **Never throw to the UI.** Map `AiGatewayError.code` with `aiErrorMessage()`.
6. **AI pre-fills; people confirm.** Show a review step or fill empty fields only. Never save AI output as the amount of record on the server.
7. **Privacy:** no prompt/reply bodies or names in logs. Prompt hints come from the owner's CRM on the server, not client text.
8. **UI gating:** `useAiStatus()` from `$lib/ai-status.svelte.ts`. Hide AI buttons when the feature is off.
9. **New feature checklist:** feature id + route in `features.ts` → prompt + schemas → `generateStructured` call → endpoint with session, zod, ownership, and `HIGH_COST_PREFIXES` rate limit → UI gated on status → tests with mocked `callModel` → docs.

## Receipt scanning map

- Server: `src/lib/server/ai/receipt-extraction.ts`, `src/routes/api/ai/receipt-extraction/+server.ts`, `src/lib/server/receipt-references.ts`, `src/lib/server/receipt-scan-context.ts`
- Client logic: `src/lib/receipt-scan/` (`scan-files`, `group-transactions`, `rows` (form adapters, merge/split), `match-party`, `apply`, `sanity`, `suggest-period`, `warning-labels`)
- UI: `src/lib/components/receipt-scan/` (`ReceiptIntake` dropzone, `ScanRowNotes`, `ScanRowActions`), `src/lib/components/payments/PaymentEntryFields.svelte`, `ReceiptUploadField.svelte`
- UX rule: **receipts first** — payment sections start with an upload dropzone; uploads create rows (no blank rows, no separate review modal). New forms must use `ReceiptIntake` + a `RowAdapter`.
- Grouping: dedupe by image hash and reference → skip failed transfers → match lender (sender for funding, receiver for repayments) → merge same date + same lender → sort by date.
