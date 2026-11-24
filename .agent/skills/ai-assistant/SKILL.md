---
name: ai-assistant
description: Ask Kame — the read-only conversational assistant (agent loop, fact tokens, tools, verifier, SSE, chat UI, evals). Use when changing assistant tools, prompts, the loop, the verifier, the panel, quick tools, voice/image attach, conversation storage, or assistant caps.
---

# AI assistant — Kame Lends

Docs: `docs/architecture/ai-assistant.md`, `docs/guides/routes/assistant.md`, `docs/workflow/qa/ai-assistant.md`. Plan: `docs/workflow/for-testing/ai-assistant-chatbot.md`.

## Invariants

1. **Read-only.** No write/propose tool. The registry rejects them; `bun run check:ai-tools` blocks DB writes, `fetch`, fs, and env under `ai/tools/`.
2. **No model arithmetic.** Tools compute with `src/lib/money/ledger.ts` and `centavos.ts`. They register facts; the model writes `{{fN}}`. Never let a model supply an amount, count, percent, or date as prose digits.
3. **Session scope only.** Build `ToolContext` from the session; re-check every id inside the tool. Never accept a user id from the body or the model.
4. **Same loaders as the app.** Go through `src/lib/server/assistant/viewer-data.ts`; it wraps `getCachedLoansByScope`, `loadLoanDetail`, CRM loaders, debts, groups, and the group projection. Do not query tables directly from a tool.
5. **Show the work.** Every money tool returns a `calc` trace built from ledger fields plus `sources` links.
6. **Fail closed.** `agent/verify.ts` rejects stray digits, unknown tokens, PII, `storage:` refs, raw HTML, and the canary. One regenerate, then deterministic fallback.
7. **Additive.** Do not edit money code, existing loaders, or existing routes to make the assistant work. Add a sibling function if needed.
8. **No PII in logs.** One line per turn: ids, counts, tokens, latency, tool names, guard mode. No text, names, amounts, or args.

## Map

| Concern            | Path                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| Turn orchestration | `src/lib/server/ai/agent/turn.ts`                                           |
| Loop               | `agent/loop.ts` · Context `agent/context.ts` · Registry `agent/registry.ts` |
| Facts/verifier     | `agent/facts.ts`, `agent/verify.ts`                                         |
| Tools              | `src/lib/server/ai/tools/*.ts`, registered in `tools/index.ts`              |
| Viewer data        | `src/lib/server/assistant/viewer-data.ts`                                   |
| Store              | `src/lib/server/ai/assistant/store.ts`                                      |
| SSE + endpoints    | `src/routes/api/ai/assistant/**`, `agent/stream.ts`                         |
| Prompt             | `src/lib/server/ai/prompts/assistant-chat.ts`                               |
| Client             | `src/lib/assistant/**`, `src/lib/components/assistant/**`                   |
| Full page          | `src/routes/assistant/**`                                                   |
| Caps/env           | `src/lib/server/ai/config.ts`, `.env.example`                               |
| Evals              | `evals/assistant/**`, `scripts/evals/run-assistant-evals.ts`                |

## Adding a tool

1. New file in `ai/tools/`, `defineTool({ name, description, args: z.object(...).strict(), capability: "read", label, run })`.
2. Read through `ctx.viewer`; check access before returning anything. Use `ToolError` with a model-facing hint for `not_found`, `ambiguous`, `forbidden`, `too_broad`, `no_data`, `unavailable`.
3. Register facts (`moneyFact`, `countFact`, `dateFact`), return `rows` with allowlisted cells, `columns`, `sources`, `notes`, and a `calc` trace for money.
4. Cap rows (default 50, max 200) and date ranges (366 days). Never return emails, phones, addresses, signatures, receipts, storage keys, or tokens.
5. Add unit tests + demo-workspace parity tests, register in `tools/index.ts`, add eval cases, and update the tool table in `ai-assistant.md`.

## Checks

```bash
bun run check
bun run check:ai-gateway
bun run check:ai-tools
bun run test
bun run eval:assistant
bun run test:integration          # local Postgres + demo seed
```

Demo data: `bun scripts/db/seed-demo-workspace.ts` (synthetic only; refuses Neon).
