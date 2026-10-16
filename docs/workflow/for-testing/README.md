---
title: "For testing"
status: active
tags: [workflow, for-testing]
updated: 2026-10-17
stage: for-testing
kind: reference
---

# For testing

Implementation complete; manual QA remaining. Move to [`../done/`](../done/) when the QA checklist passes.

| Plan                                                                         | Status   | Summary                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [loan-groups-v2.md](./loan-groups-v2.md)                                     | Local QA | Group access from loan parties, group hubs, per-group Google Calendar and Telegram. QA: [`../qa/loan-groups-v2.md`](../qa/loan-groups-v2.md)                                                                               |
| [ai-platform-and-receipt-autofill.md](./ai-platform-and-receipt-autofill.md) | Live QA  | AI gateway (Gemini + Groq, usage log, kill switch, caps) and multi-receipt scan → review → apply for loan form, Fund Transfer and Add Received Payment. QA: [`../qa/ai-receipt-autofill.md`](../qa/ai-receipt-autofill.md) |
