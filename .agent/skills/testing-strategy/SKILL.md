---
name: testing-strategy
description: "Use when adding tests, choosing a test layer, or fixing CI for money, routes, dates, or components."
---

# Testing strategy

| Layer       | Command                                     | Covers                                                          |
| ----------- | ------------------------------------------- | --------------------------------------------------------------- |
| Unit        | `bun run test:unit`                         | Centavos, ledger, status, business dates, editor reducer, debts |
| Property    | same                                        | Ledger invariants with `fast-check`                             |
| Timezone    | `bun run test:unit:tz`                      | Manila, UTC, US-Pacific                                         |
| Integration | `bun run test:integration`                  | Real local Postgres, routes, transactions, audit                |
| Component   | same as unit                                | Interest editor and form money paths                            |
| E2E         | `bun run test:e2e -- --project=money-flows` | List/detail/investor consistency                                |
| A11y        | `--project=a11y`                            | axe on key routes                                               |

## Rules

- **Never test against production.** Integration setup refuses non-local URLs.
- Fixtures live in `src/lib/money/__fixtures__/` or next to the module. Hand-check every expected number.
- A bug fix needs a test that fails before and passes after. For a known-bad old behavior, use `it.fails` with the finding ID, then flip it when fixed.
- Property tests assert invariants, not implementation details. Keep runs ≤ 100.
- Component tests use `@testing-library/svelte`. Do not snapshot money strings; assert the value.
- E2E picks existing rows and skips cleanly on an empty database. It must not create production data.

## Adding a money route test

1. Add the schema unit test.
2. Add an integration test that calls the handler with a mocked session.
3. Add one reconciliation assertion (list equals detail equals ledger).
4. Add the route to the a11y or money-flows project when it has a screen.
