---
title: "QA fix execution plan"
status: in-progress
tags: [qa, fixes, batches, testing]
updated: 2026-11-21
stage: in-progress
kind: plan
---

# QA fix execution plan

Execution plan for the findings in [`qa-ux-and-test-coverage-audit.md`](./qa-ux-and-test-coverage-audit.md). One batch per branch/PR. A batch is complete only when its tests pass and the finding rows are marked fixed.

## Ranking

### P0 · release blockers

1. LEGAL-01, LEGAL-03: signing preview must match the contract.
2. DEEP-04, DEEP-01: loan detail must refresh after payment and Fund Transfer.
3. DEEP-03: received payments must be editable and removable with a confirmation.
4. DEEP-02: template save must not crash after editing numeric fields.
5. DEEP-05: multi-interest creation must not require a hidden rate.
6. DEEP-06: periods must sort by date; the final period must be the latest date.
7. DEEP-07: group Add loans must have a working Review/Add action.
8. MONEY-01, MONEY-02: existing debt installments and due dates must match the live schedule.
9. PERM-01, PERM-03: read-only viewers must not see write actions or bulk select.
10. A11Y-02, A11Y-03: named filter comboboxes and keyboard-reachable loan rows.
11. TEST-01, TEST-10: authenticated browser smoke and CI coverage must work.

### P1 · high impact

12. DEEP-08: group wizard must not select every loan by default or ignore the investor filter.
13. DEEP-09: contact validation and orphan user cleanup.
14. DEEP-10: table pagination for large loan lists.
15. DEEP-11: duplicate must copy contract settings, groups, witnesses, and commissions.
16. DEEP-12: single-interest loan needs a visible Pay action.
17. MONEY-03: rename the total-rate metric; stop displaying 110% as “Rate”.
18. MONEY-04: Past Due must not show ₱0.00 rows.
19. LEGAL-02: Terms and Privacy pages or no claim.
20. FLAG-01, FLAG-02: Transactions route must be gated and free of developer copy.
21. PERM-02 / PRIV-01: decide co-investor visibility; hide private money by default.
22. A11Y-01, A11Y-04, A11Y-05: contrast and accessible names.
23. UX-01, UX-02: mobile scope tabs and Today overlap.
24. UX-08: storage image fallback.
25. TEST-02 through TEST-09, TEST-11 through TEST-17: test coverage and CI.

### P2 · should fix

26. UX-03 to UX-07, UX-09 to UX-15.
27. DEEP-13, DEEP-14, DEEP-15.
28. CODE-01, CODE-02, CODE-03.

## Batches

| Batch | Branch                           | Scope                                                                                                                           | Findings                                                         |
| ----- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1     | `fix/qa-01-money-integrity`      | Detail refresh, payment edit/delete, single-interest pay, debt schedule sync, past-due display                                  | DEEP-01, DEEP-03, DEEP-04, DEEP-12, MONEY-01, MONEY-02, MONEY-04 |
| 2     | `fix/qa-02-loan-form-templates`  | Template numeric crash, multi-interest validation, period ordering, duplicate fidelity, rate label                              | DEEP-02, DEEP-05, DEEP-06, DEEP-11, MONEY-03, UX-10              |
| 3     | `fix/qa-03-groups`               | Add loans sheet, wizard selection/filter, upcoming dates, group counts, labels                                                  | DEEP-07, DEEP-08, DEEP-15, UX-05, UX-06, UX-07                   |
| 4     | `fix/qa-04-signing-legal`        | Full contract preview, signature parity, legal pages, create modal                                                              | LEGAL-01, LEGAL-02, LEGAL-03, DEEP-13                            |
| 5     | `fix/qa-05-permissions-security` | Read-only actions, transaction flag, contact validation, co-investor privacy                                                    | PERM-01, PERM-02, PERM-03, FLAG-01, FLAG-02, DEEP-09             |
| 6     | `fix/qa-06-accessibility`        | Avatar and token contrast, combobox names, keyboard rows, landing controls                                                      | A11Y-01 to A11Y-05, CODE-01                                      |
| 7     | `fix/qa-07-ux-mobile`            | Mobile tabs, Today control, number/date formatting, storage fallback, push state, form actions, settings index, pagination, CSV | UX-01 to UX-09, UX-11 to UX-15, DEEP-10, DEEP-14, CODE-02        |
| 8     | `fix/qa-08-test-infra`           | Fix broken Playwright, route smoke, coverage, CI, mobile/dark/WebKit, env isolation                                             | TEST-01 to TEST-17, CODE-03                                      |

## Rules for each batch

1. Reproduce the finding with a failing test when practical.
2. Make the narrowest fix at the responsible layer.
3. Add or update the specific test that would have caught it.
4. Run `bun run check`, targeted unit/integration/E2E, then the full batch gate.
5. Update the audit row to `fixed` and add a one-line evidence note.
6. Commit only that batch. Do not fold unrelated cleanup into a batch.

## Shared gates

- `bun run check`
- `bun run format:check`
- `bun run lint:js`
- `bun run test:unit`
- `bun run test:integration`
- `bun run build`
- Targeted Playwright projects for the batch
- `bun run check:ai-tooling-sync`
- `bun run db:health:money` after money batches
