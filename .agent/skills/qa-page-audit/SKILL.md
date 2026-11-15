---
name: qa-page-audit
description: "Use when running the Phase 9 page-by-page audit, writing persona checklists, or recording findings in a plan tracker."
---

# QA page audit

## Before you start

1. Open the plan in `docs/workflow/` and its findings tracker.
2. Confirm you are on a local database (`DATABASE_URL` on `127.0.0.1`). Never audit against production.
3. Have a test group, one multi-interest loan, one single-interest loan, one agent investor, and one debt.

## Persona passes

Run every route as:

- **Owner** on desktop, then phone.
- **Investor / borrower / witness** (read-only and signing).
- **Group viewer** (read-only loan access).
- **Anonymous** for public and error routes.

For every route check: loading skeleton, empty state, error state, slow network, 375px and 1440px, keyboard and screen reader, light and dark mode, price visibility on and off, online and offline.

## Recording a finding

Add a row to the plan tracker with:

- ID (`UX-xx`, `BUG-xx`, or the existing category),
- severity S1–S4,
- evidence level: probe / code / verify,
- title with the user-visible impact,
- the task that fixes it,
- status.

A finding is **verified** only when the reproduction steps and the fix both exist. "Looks fine" is not evidence.

## Money screens

Compare every number with `buildLoanLedger` for the same loan and today. Record the ledger values next to the screen values in the finding. Screens that disagree are S2.
