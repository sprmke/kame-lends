---
title: "AI receipt autofill — manual QA"
status: active
tags: [qa, ai, receipts]
updated: 2026-10-17
kind: qa
---

# AI receipt autofill — manual QA

Plan: [`../for-testing/ai-platform-and-receipt-autofill.md`](../for-testing/ai-platform-and-receipt-autofill.md)

## Setup

1. `bun run db:migrate:pending` (applies `0028_ai_platform.sql`).
2. Put a Gemini key in `.env.local` (`GEMINI_API_KEY=` or `GEMINI_API_KEYS=`). Optional: `GROQ_API_KEY`.
3. Collect real screenshots: GCash, Maya, BDO/BPI app, InstaPay, a cash photo, a transaction-history screenshot, a blurry one, an iPhone HEIC, an unrelated photo.

## Automated (done)

- [x] Unit: gateway transport/client, receipt parsing, sanity, matching, grouping, merge/split, apply, period suggestion (`bun run test`)
- [x] E2E `receipt-scan` project (mocked AI, 11 tests): dialog starts with dropzone; 4 receipts → 2 transfers with receipts tied; Add receipts appends; merge / split / remove via ⋯; same-loan duplicates skipped; AI off → one row per receipt; row Split into 2; edit loan principal + received tabs; create loan from receipts adds investor + borrower and **saves**; fund transfer **saves** receipts + v2 reading; unmocked API auth/validation/no-key
- [x] Migration on local Docker; `bun run check`, `bun run build`, precache budget, `check:ai-gateway`

## Live (real model)

- [ ] Fund Transfer / Add Received Payment open with only **Upload receipts**; no blank row
- [ ] 3 receipts where #2 and #3 are the same transfer date → 2 rows, #2 and #3 attached to row 2

- [ ] Fund Transfer: 3+ receipts across 2 dates for one lender → same-date ones merged, other date separate; amounts and dates correct
- [ ] Fund Transfer with 2+ lenders on the loan: sender names (incl. masked `JU** DE** C.`) pick the right lender
- [ ] Add Received Payment: receiver matched as lender; payment equal to a period's interest pre-selects that period
- [ ] Transaction-history screenshot → one row per date; failed transfers skipped (note in review)
- [ ] Re-upload a receipt already saved on a loan → "Already recorded in …" badge; on the same loan in edit mode, row starts unchecked
- [ ] Unrelated photo → unchecked, "Doesn't look like payment proof"
- [ ] Create loan with no investors: Investors card **Scan receipts** → matched investors added, borrower set from receiver name; 2 lenders in one batch land on the right cards
- [ ] Edit loan Received tab: single upload fills an empty row (was broken before)
- [ ] Row upload with 2 receipts of different dates → **Split into 2** → source row updated, second row added
- [ ] Merge with previous / Split receipts / Remove in the review
- [ ] Submit after apply → loan detail shows disbursements/received payments with receipt thumbnails
- [ ] iPhone Safari: HEIC photo scans; desktop Chrome HEIC shows the "can't open HEIC" message
- [ ] `ai_usage_events` rows: tokens, cost, latency, provider; same image again → `cache_hit = true`
- [ ] Invalid Gemini key + valid `GROQ_API_KEY` → Groq used (`fallback_used = true`)
- [ ] `AI_ENABLED=false` → no Scan receipts buttons; uploads still work
- [ ] `AI_DAILY_CALLS_PER_USER=1` → second scan shows the daily-limit message
- [ ] Phone (375–390px): review is a bottom sheet; ⋯ opens the action sheet; Apply/Cancel reachable
