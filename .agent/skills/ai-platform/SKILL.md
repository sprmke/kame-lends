---
name: ai-platform
description: AI gateway for Kame Lends — Gemini/Groq via src/lib/server/ai (generateStructured, runAgentTurn), prompts, usage log, kill switch, receipt scanning, assistant. Use when adding or changing any AI/LLM feature, prompt, model, receipt scan, agent loop, or AI env var.
---

# AI platform — Kame Lends

Full docs: `docs/architecture/ai-platform.md`, `docs/architecture/ai-assistant.md`.

## Rules

1. **All model calls go through `src/lib/server/ai/client.ts`.** Structured features use `generateStructured()`; agent profiles use `runAgentTurn()` / `runAssistantLoop()`. Never `fetch` a provider from feature code. Provider hosts live only in `transport.ts` (`bun run check:ai-gateway` enforces it).
2. **Keys only from env** via `config.ts` (`GEMINI_API_KEYS` / `GEMINI_API_KEY`, `GROQ_API_KEY`). Gemini key in the `x-goog-api-key` header, never in the URL.
3. **Versioned prompts** in `src/lib/server/ai/prompts/` with `definePrompt`. Bump `version` on any prompt or schema change. Include `DOCUMENT_INJECTION_RULE` for images and documents.
4. **Structured output:** Gemini `responseSchema` + zod schema. Coerce field values leniently, but fail on wrong structure so the client's single repair retry can run.
5. **Never throw to the UI.** Map `AiGatewayError.code` with `aiErrorMessage()`.
6. **AI pre-fills; people confirm.** Show a review step or fill empty fields only. Never save AI output as the amount of record on the server.
7. **Privacy:** no prompt/reply bodies or names in logs. Prompt hints come from the owner's CRM on the server, not client text.
8. **UI gating:** `useAiStatus()` from `$lib/ai-status.svelte.ts`. Hide AI buttons when the feature is off.
9. **New feature checklist:** feature id + route in `features.ts` → prompt + schemas → `generateStructured` call → endpoint with session, zod, ownership, and `HIGH_COST_PREFIXES` rate limit → UI gated on status → tests with mocked `callModel` → docs.

## Agent profiles / assistant

- The assistant is read-only by construction: `src/lib/server/ai/agent/registry.ts` rejects non-read tools, and `bun run check:ai-tools` blocks DB writes, network, fs, and env inside `src/lib/server/ai/tools/`.
- Model output never types numbers. Tools register facts and the model writes `{{fN}}`. `agent/verify.ts` rejects stray digits, PII, raw HTML, and prompt leakage, then regenerates once or falls back to deterministic blocks.
- Scope comes from `ToolContext` built from the session; tools re-check every id. Use `assistant/viewer-data.ts`; never query `db` from a tool.
- New tool: add a file in `ai/tools/`, strict zod args, `capability: "read"`, a `label`, `sources`, capped rows, and unit + parity tests. Register it in `ai/tools/index.ts` and add eval cases.

## Receipt scanning map

- Server: `src/lib/server/ai/receipt-extraction.ts`, `src/routes/api/ai/receipt-extraction/+server.ts`, `src/lib/server/receipt-references.ts`, `src/lib/server/receipt-scan-context.ts`
- Client logic: `src/lib/receipt-scan/` (`scan-files`, `group-transactions`, `rows` (form adapters, merge/split), `match-party`, `apply`, `sanity`, `suggest-period`, `warning-labels`)
- UI: `src/lib/components/receipt-scan/` (`ReceiptIntake` dropzone, `ScanRowNotes`, `ScanRowActions`), `src/lib/components/payments/PaymentEntryFields.svelte`, `ReceiptUploadField.svelte`
- UX rule: **form first** — Fund Transfer, Add Received Payment, and loan-form disbursement rows open with the fields visible. The receipt is a required field on the row, not a gate before the form. `ReceiptIntake` (compact **Add receipts**) fills a blank row or appends more via `RowAdapter`. A new loan with no investors yet can still start from the Investors-card dropzone. No separate review modal.
- Grouping: dedupe by image hash and reference → skip failed transfers → match lender (sender for funding, receiver for repayments) → merge same date + same lender → sort by date. An image that is not a receipt stays on the row being filled, with a warning. It does not add an empty transaction or block save. A chat that states an amount is read as a transfer.
