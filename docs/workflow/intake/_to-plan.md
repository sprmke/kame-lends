---
title: "To plan"
status: active
tags: [planning]
updated: 2026-11-24
---

**Status legend:** ❌ cancelled / won't do · ✅ done · 🧪 for testing · 📋 planned (plan doc written) · 🚧 in progress · 🔵 pending / open

===

🧪 Neon transfer cost guards

Cut Neon network-transfer burn (daily fat backup cron, receipt-blob SELECTs) and add rate-limit / usage alerts so a quiet few-user app cannot suspend the database again.

→ **For testing:** [`../for-testing/neon-transfer-cost-guards.md`](../for-testing/neon-transfer-cost-guards.md)

===

🧪 AI integration + receipt scan autofill

Integrate AI the same way Kame Homes / Kame Ops do, but harden it (gateway, usage log, kill switch, caps). First feature: analyze uploaded transfer receipts (one or many) when creating/editing a loan, doing a fund transfer, or adding a received payment, and pre-populate the active form. Multiple receipts with different dates become separate transactions; same date + same lender merge into one. User reviews and edits before applying.

→ **For testing:** [`../for-testing/ai-platform-and-receipt-autofill.md`](../for-testing/ai-platform-and-receipt-autofill.md) · QA: [`../qa/ai-receipt-autofill.md`](../qa/ai-receipt-autofill.md)

===

🧪 Telegram message templates

Group Telegram templates are one line and skip borrower, investors, due date, and amount. Give each reminder, digest, and loan action a detailed default, with placeholders the owner can still insert.

→ **For testing:** [`../for-testing/telegram-message-templates.md`](../for-testing/telegram-message-templates.md)

===

🧪 AI assistant (chat over lending data)

Chatbot that answers questions about the user's own loans, borrowers, investors, payments, and debts (for example "how much does X still owe?"). Read-only tool agent on the existing AI gateway, numbers filled in by the server from the money engine, expandable calculation breakdowns, streaming steps, image and voice input, history, evals, and guardrails. Built to be reused by later AI features and to serve as the portfolio case study.

→ **For testing:** [`../for-testing/ai-assistant-chatbot.md`](../for-testing/ai-assistant-chatbot.md)

===

🚧 Full app audit + money correctness

Review every page, section, feature, and calculation end to end, acting as developer, QA, PM, and user. Money must be 100% correct; adding and editing loans with multiple interests behaves strangely. List every finding, fix them one by one, and add the tests that keep them fixed (unit, property, timezone, DB integration, E2E, reconciliation). Also cover UX, speed, PWA, security, and code health.

→ **Plan:** [`../in-progress/full-app-audit-and-money-correctness.md`](../in-progress/full-app-audit-and-money-correctness.md)

===

🚧 Loan templates

Per-user loan templates in Settings. Prefill borrower, name, type, groups, rate, and an optional date-range name when creating a loan. No shared defaults.

→ **In progress:** [`../in-progress/loan-templates.md`](../in-progress/loan-templates.md)

===

🔵 Receipts + AI scan for bank loan (debt) payments

`debt_received_payments` has no receipt columns. Add receipts and reuse the receipt-scan review for `DebtPaymentSchedule.svelte`.

===

🔵 Receipt editing in detail-page edit modals

`InvestorTransactionsDisplay.svelte` edit modals only send amount/date; `PATCH /api/received-payments/[id]` ignores receipts.

===

🔵 PDF receipt scanning

Accept bank statement / receipt PDFs in the receipt scanner (Gemini only; no Groq fallback for PDFs).

===

🔵 AI usage dashboard

Settings card showing AI calls, cost and fallback rate from `ai_usage_events`.
===

📋 Production data repairs and release verification

Decide and repair the remaining prod data anomalies (duplicate period dates, zero-capital fixed, receipt-less payments, unlinked payments) and finish calendar, Telegram, push, email, and device checks.

→ **Plan:** [`../planned/prod-data-repairs-and-release-verification.md`](../planned/prod-data-repairs-and-release-verification.md)

===

📋 QA, UX, and test coverage audit

Full app crawl and deep CRUD/payment/signing flows against a local production snapshot: catalog every test layer and gap, broken Playwright specs, signing preview missing the lender allocation, debt amount mismatch, hidden allocations, broken template save, unreachable payment delete, group Add loans, accessibility failures, read-only users seeing write actions, mobile layout bugs, and the UI/UX improvement backlog.

→ **Plan:** [`../planned/qa-ux-and-test-coverage-audit.md`](../planned/qa-ux-and-test-coverage-audit.md)

✅ Email notifications for important actions

Immediate emails for loan, payment, group, and signing events, a configurable daily reminder digest for unsigned contracts and due dates, per-user email preferences in Settings, and dedupe plus retry logging so users are never spammed.

→ **Done:** [`../done/email-notifications.md`](../done/email-notifications.md)
