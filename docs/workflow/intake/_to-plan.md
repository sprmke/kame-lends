---
title: "To plan"
status: active
tags: [planning]
updated: 2026-10-16
---

**Status legend:** ❌ cancelled / won't do · ✅ done · 🧪 for testing · 📋 planned (plan doc written) · 🚧 in progress · 🔵 pending / open

===

🧪 AI integration + receipt scan autofill

Integrate AI the same way Kame Homes / Kame Ops do, but harden it (gateway, usage log, kill switch, caps). First feature: analyze uploaded transfer receipts (one or many) when creating/editing a loan, doing a fund transfer, or adding a received payment, and pre-populate the active form. Multiple receipts with different dates become separate transactions; same date + same lender merge into one. User reviews and edits before applying.

→ **For testing:** [`../for-testing/ai-platform-and-receipt-autofill.md`](../for-testing/ai-platform-and-receipt-autofill.md) · QA: [`../qa/ai-receipt-autofill.md`](../qa/ai-receipt-autofill.md)

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
