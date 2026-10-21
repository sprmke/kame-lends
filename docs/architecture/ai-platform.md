# AI platform

Part of [`docs/PROJECT.md`](../PROJECT.md). Plan: [`workflow/for-testing/ai-platform-and-receipt-autofill.md`](../workflow/for-testing/ai-platform-and-receipt-autofill.md).

Kame Lends uses AI to **pre-fill forms**, never to save data by itself. A person always reviews and confirms. The design follows the Kame Homes gateway and leaves out its SaaS layers (plans, credits, wallets). It also avoids the Kame Ops gaps (client-supplied storage paths, forgeable AI results, auto-apply, no dedupe, no usage log).

## Layers

```
feature (receipt-extraction.ts)
  → client.ts       kill switch · daily cap · cache · zod validation + 1 repair retry · metering
    → transport.ts  only file that calls providers · timeouts · retries · key rotation · Groq fallback
      → Gemini (primary) / Groq (fallback)
```

| File (`src/lib/server/ai/`) | Role                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config.ts`                 | Env: keys, `AI_ENABLED`, `AI_DISABLED_FEATURES`, `AI_DAILY_CALLS_PER_USER`, `AI_RESPONSE_CACHE_DISABLED`; `getAiStatus()`                         |
| `features.ts`               | Feature ids and routing: model, fallback model, `maxOutputTokens`, `thinkingBudget: 0`, timeout, prices                                           |
| `transport.ts`              | Gemini REST (`x-goog-api-key` header), Groq OpenAI-compatible; 2 attempts per key, jittered backoff honoring `retry-after`, 55s whole-call budget |
| `client.ts`                 | `generateStructured()` — the only entry point for feature code                                                                                    |
| `prompt.ts`, `prompts/*.ts` | Versioned prompts (`id` + `version`), `DOCUMENT_INJECTION_RULE`                                                                                   |
| `usage.ts`                  | `ai_usage_events` row + one structured log line per call                                                                                          |
| `cache.ts`                  | `ai_response_cache` (sha256 of user + prompt@version + model + input), 30-day TTL, lazy sweep                                                     |
| `errors.ts`                 | `AiGatewayError` codes and friendly messages                                                                                                      |

`scripts/check-ai-gateway.mjs` (`bun run check:ai-gateway`, CI and CD) fails if a provider host appears outside `transport.ts` or an API key is put in a URL query string.

## Retry and fallback rules

| Failure                           | Action                                                 |
| --------------------------------- | ------------------------------------------------------ |
| Timeout, network, 429, 5xx        | Retry same key once with backoff                       |
| 401 / 403 / 400 `API_KEY_INVALID` | Next key, no retry                                     |
| Other 400                         | Stop Gemini, try Groq if allowed                       |
| Empty reply (e.g. safety block)   | Next key                                               |
| All Gemini keys fail              | Groq (JPEG / PNG / GIF / WebP only)                    |
| Reply fails the zod schema        | One repair call with the issues, then `invalid_output` |

## Controls

| Env                          | Default        | Effect                                                |
| ---------------------------- | -------------- | ----------------------------------------------------- |
| `AI_ENABLED`                 | on (with keys) | `false` turns every AI feature off                    |
| `AI_DISABLED_FEATURES`       | none           | Comma list, e.g. `receipt_extraction`                 |
| `AI_DAILY_CALLS_PER_USER`    | `300`          | Model calls per user per rolling 24h; `0` = unlimited |
| `AI_RESPONSE_CACHE_DISABLED` | off            | `1` skips the cache                                   |

Per-path request rate limiting (`src/lib/server/rate-limit.ts`, 30/min/user) also covers `/api/ai/receipt-extraction`.

## Cost and privacy

- Receipt extraction: `gemini-2.5-flash`, thinking off, max 2048 output tokens. A compressed receipt (≤1600px) is roughly 1–2k input tokens, so about **$0.001 per scan**. Re-uploading the same image is a cache hit (no cost).
- `ai_usage_events` stores tokens, estimated USD, latency, provider, model, prompt id/version, status, error code, fallback, cache hit. No prompt or reply text, no names.
- Logs print one JSON line (`ai.<feature>.<status>`) with the same fields. Receipt summaries are never logged.
- **Use a paid-tier Gemini key in production.** Free-tier data may be used by Google to improve products, and receipts contain names and account numbers.
- Text inside images is treated as evidence, never instructions (`DOCUMENT_INJECTION_RULE`). Prompt hints (lender and borrower names) come from the owner's CRM on the server, never from client text.

Useful query:

```sql
select feature, provider, status, count(*), sum(est_cost_usd), avg(latency_ms)::int,
       sum(case when fallback_used then 1 else 0 end) as fallbacks,
       sum(case when cache_hit then 1 else 0 end) as cache_hits
from ai_usage_events
where created_at > now() - interval '7 days'
group by 1, 2, 3 order by 1, 2, 3;
```

## Adding an AI feature

1. Add the id to `AI_FEATURES` and a route in `features.ts`.
2. Write `prompts/<feature>.ts` with `definePrompt({ id, version, build })`, a Gemini `responseSchema`, and a zod schema for the reply. Bump `version` whenever the prompt or schema changes (it is part of the cache key).
3. Call `generateStructured()` from a server module. Catch `AiGatewayError` and return `{ success: false, error: aiErrorMessage(code), code }`. Never throw to the UI.
4. Expose it through a `+server.ts` endpoint with `getSession`, zod body validation, and ownership checks. Add the path to `HIGH_COST_PREFIXES` in `rate-limit.ts`.
5. Gate the UI on `useAiStatus()` (`src/lib/ai-status.svelte.ts`). AI output fills a form or a review step; the user confirms before anything is saved.
6. Unit-test the parser and mapping with a mocked `callModel` (see `receipt-extraction.test.ts`, `client.test.ts`). E2E: mock the endpoint with `page.route`.
7. Update this doc, `docs/PROJECT.md`, and the route guide.

## Receipt extraction

See `docs/PROJECT.md` → "AI receipt scanning" and "Payment receipts (UI)", and [`guides/routes/loans-detail.md`](../guides/routes/loans-detail.md).
