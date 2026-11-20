---
title: "QA, UX, and test coverage audit"
status: planned
tags:
  [
    audit,
    testing,
    qa,
    ux,
    accessibility,
    mobile,
    data-integrity,
    security,
    legal,
  ]
updated: 2026-11-21
stage: planned
kind: plan
---

# QA, UX, and test coverage audit

## Goal

Record what the app does well, what is broken, and what is missing across testing, UX, accessibility, money display, mobile, and legal correctness. This is an evidence document, not an implementation pass. Each finding has a suggested fix, a test that should prevent it from returning, and a priority.

Companion plan: [`full-app-audit-and-money-correctness.md`](../in-progress/full-app-audit-and-money-correctness.md). That plan owns the money engine, persistence, and production repairs. This audit focuses on the **current user experience, the test layers that exist today, and the gaps that let visible defects ship**.

## Scope and safety

- **No production system was contacted.** Every command used the local Docker database at `127.0.0.1:5433` or read a dump file under `~/Backups/kame-lends/`. The production snapshot was inspected only as a local copy.
- The local database was restored from the **2026-11-16 13:59** snapshot (131 loans, 12 users, 4 groups, 2 bank loans). The source dump was read-only.
- No `--prod` migration, repair, backup, or remote SQL command was run.
- Integration tests refuse to run unless the URL is local (`src/lib/server/test/integration-setup.ts`).
- E2E fixtures were created and removed only in the local database.
- `bun run db:health:money` was run read-only against the local snapshot.
- Branch: `sprmke/test-coverage-audit-and`.
- Audit dates: **2026-11-20** (crawl and test pass) and **2026-11-21** (deep flow pass).

## How the audit was run

| Layer                   | What was executed                                                                                                    | Result                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Typecheck               | `bun run check`                                                                                                      | 0 errors, 100 warnings                               |
| Lint and format         | `bun run lint`                                                                                                       | 0 errors, 121 warnings; Prettier clean               |
| Unit                    | `bun run test:unit`                                                                                                  | 122 files, 658 passed, 4 skipped                     |
| Coverage gate           | `bun run test:coverage`                                                                                              | Passed for the 4 configured money files              |
| Full lib coverage probe | temp Vitest config over `src/lib/**`                                                                                 | 24.86% lines, 557 files                              |
| Timezone matrix         | `bun run test:unit:tz`                                                                                               | 90 tests passed in Manila, UTC, and US Pacific       |
| DB integration          | `bun run test:integration`                                                                                           | 7 files, 69 tests passed                             |
| Build                   | `bun run build`                                                                                                      | Passed                                               |
| AI guards               | `check:ai-gateway`, `check:ai-tooling-sync`                                                                          | Passed                                               |
| Precache budget         | `node scripts/pwa/check-precache-budget.mjs`                                                                         | 5,893 KiB / 12,800 KiB                               |
| Browser crawl           | Playwright against `http://localhost:3200`                                                                           | 32 routes at 1440px + 30 routes at 390px, light mode |
| Accessibility           | axe-core on 16 routes, light + dark                                                                                  | Violations on every route                            |
| Flows                   | Playwright scripts for dashboard, loans, detail, settings, groups, debts, forms, party views, signing, mobile sheets | See findings                                         |
| Deep flows              | UI create/edit/delete for parties, payments, loans, debts, groups, templates, exports, backup, signing               | See DEEP findings                                    |
| PWA                     | Playwright PWA spec against `vite preview` on :3201                                                                  | 1 passed, 3 failed                                   |

### Routes covered

App routes: `/dashboard`, `/loans`, `/loans/new`, `/loans/[id]`, `/loans/[id]/sign`, `/investors`, `/investors/new`, `/investors/[id]`, `/borrowers`, `/borrowers/new`, `/borrowers/[id]`, `/witnesses`, `/witnesses/new`, `/witnesses/[id]`, `/debts`, `/debts/new`, `/debts/[id]`, `/groups`, `/groups/new`, `/groups/[id]`, `/settings`, `/transactions`, `/investments`, `/borrowed`, `/witnessed`, `/commissioned`, `/barrowers/[id]`, `/`, `/signin`, `/sign/[token]`, and the 404 route.

Personas: owner, investor with an unsigned invitation, borrower with an unsigned invitation, witness, unrelated signed-in user, anonymous visitor.

States: desktop 1440×900, phone 390×844, light, dark, price visibility on/off, empty filters, and local storage unconfigured.

## Executive summary

The core owner experience is in good shape. Every main route loads, the money engine is well tested, the build is clean, and the new mobile shell is coherent. The failings are concentrated in four places:

1. **The signing preview is not the contract.** The sign page renders a reduced contract that omits the Parties block, the Lender Allocation block, and the signature blocks. The clauses still say “as stated in the Lender Allocation section above.” The PDF has those sections; the signer does not see them. This is a release blocker.
2. **One bank loan shows two different payment amounts.** The live schedule says ₱20,199.70 per month. The stored installment and the Record payment default say ₱20,711.33. The difference is ₱511.63 per period, ₱6,139.59 over 12 periods.
3. **The test suite looks larger than the signal it provides.** The broad authenticated route spec cannot run, the accessibility spec fails on every route, the modal spec looks for a button that no longer exists, the PWA spec fails locally, and GitHub CI runs only a small subset of the Playwright projects. The coverage gate protects four money files, not the app.
4. **Read-only users are shown write actions.** A witness or group viewer can open Record interest payment and fill it in; the API rejects the save, but the UI invites the action. The same party views expose other investors’ capital and notes, which needs a product decision.

### Top 10 actions before release

| #   | Action                                                                                   | Finding          |
| --- | ---------------------------------------------------------------------------------------- | ---------------- |
| 1   | Render the full contract on `/loans/[id]/sign` (parties, lender allocation, signatures)  | LEGAL-01         |
| 2   | Re-sync stored debt installments and use the live schedule for the payment default       | MONEY-01         |
| 3   | Hide Pay, bulk select, and admin actions from read-only viewers                          | PERM-01          |
| 4   | Fix the authenticated Playwright spec and add a route smoke matrix to CI                 | TEST-01, TEST-10 |
| 5   | Make every filter combobox named and every clickable row keyboard reachable              | A11Y-02, A11Y-03 |
| 6   | Fix avatar and muted/chart contrast, including dark mode                                 | A11Y-01, A11Y-04 |
| 7   | Add Terms of Service and Privacy Policy pages, or remove the claim                       | LEGAL-02         |
| 8   | Guard `/transactions` behind `SHOW_TRANSACTIONS_UI`; remove the developer message        | FLAG-01          |
| 9   | Fix the mobile scope tab clipping and the floating Today button overlap                  | UX-01, UX-02     |
| 10  | Rename the investor “Rate” metric so 110% cannot be read as an annual or per-period rate | MONEY-03         |

### Second-pass additions

The deep flow pass found four more release blockers that the page crawl could not see: **Fund Transfer and payment saves leave the detail page stale until reload** (DEEP-01/DEEP-04), **loan template save crashes after editing the term field** (DEEP-02), **received payments cannot be removed and single-interest payments cannot be edited** (DEEP-03), and **the detail page does not refresh after a payment** (DEEP-04). The group “Add loans” action is also unreachable (DEEP-07), and the multi-interest editor still has a period-order bug (DEEP-06).

## Test inventory and results

| Layer                             | Exists                  | Runs in GitHub CI       | State                 |
| --------------------------------- | ----------------------- | ----------------------- | --------------------- |
| Unit (Vitest)                     | Yes, 122 files          | Yes                     | Green                 |
| Money golden cases                | Yes                     | Yes                     | Green                 |
| Property tests (`fast-check`)     | Yes                     | Yes                     | Green                 |
| Timezone matrix                   | Yes                     | Yes (`integration` job) | Green                 |
| Component tests (Testing Library) | Yes, a small set        | Yes                     | Green                 |
| DB integration                    | Yes, 69 tests           | Yes                     | Green                 |
| Reconciliation                    | Yes                     | Yes                     | Green                 |
| E2E smoke (public)                | Yes                     | Yes                     | Green                 |
| E2E money                         | Yes                     | Yes                     | Green                 |
| E2E a11y                          | Yes, 6 routes           | Yes                     | **Failing**           |
| E2E authenticated routes          | Yes, broad              | **No**                  | **Cannot start**      |
| E2E modals                        | Yes                     | **No**                  | **Failing**           |
| E2E groups                        | Yes                     | **No**                  | **Failing (1)**       |
| E2E CRUD                          | Yes                     | One loan test only      | Passing subset        |
| E2E advanced controls             | Yes                     | **No**                  | Passing when run      |
| E2E receipt scan                  | Yes                     | **No**                  | **Failing (1)**       |
| E2E visual parity                 | Yes, desktop light only | **No**                  | **Failing (1)**       |
| E2E PWA                           | Yes                     | **No**                  | **Failing (3)**       |
| Lighthouse                        | Yes                     | Non-blocking            | Not run in this audit |
| Load/concurrency                  | No                      | No                      | Missing               |
| Cross-browser / WebKit            | No                      | No                      | Missing               |

### Test results in detail

- `bun run test:unit` fails if the developer’s `.env.local` sets `AI_ENABLED=false`; 7 AI tests then fail. Removing that one local value makes the suite green. Tests should stub private env instead of reading the developer file.
- The configured coverage gate covers `ledger.ts`, `centavos.ts`, `status.ts`, and `interest-period-editor.ts`. It reports roughly 94% statements and 97% lines. That is good for the engine, but it is not app coverage.
- A full `src/lib` coverage probe reports **24.86% lines / 22.67% branches**. Large components and server modules sit at 0%: `LoanForm.svelte`, `LoanListPage.svelte`, `InvestorDetailContent.svelte`, `CreateGroupWizard.svelte`, `group-calendar.ts`, `group-access.ts`, `dashboard-data.ts`, `party-directory.ts`, `debt-interest-period-sync.ts`, and many others.
- `e2e/authenticated-routes.spec.ts` uses `test.beforeEach((_fixtures, testInfo) => …)`. Playwright rejects the first parameter because it does not use object destructuring. The entire spec stops before the first test.
- `e2e/modal-interactions.spec.ts` expects a `View` button inside the loan table. The current table opens the row on click and has no `View` button, so the first test times out and the serial project stops.
- `e2e/loan-groups-v2.spec.ts` uses `getByText(name).first()` for the hub heading. On `?tab=loans` the first match is a hidden mobile heading, so the assertion fails even though the desktop heading is visible.
- `e2e/receipt-scan.spec.ts` “AI off: each receipt becomes a row” uploads two images and expects two rows; it gets one. Seven remaining tests do not run because the project is serial. This needs a product-level check, not just a test edit.
- `e2e/pwa.spec.ts` passes the service-worker registration test but fails three offline tests with `page.reload: net::ERR_ABORTED; maybe frame was detached`. The same spec is not part of the GitHub workflows.
- `e2e/visual-parity.spec.ts` fails the investors page because the captured full-page image is 980px tall while the baseline is 900px. The project only covers 1440×900 light.
- CI runs `setup`, `money-flows`, `a11y`, `multi-role -g "money health"`, and one `crud-flows` test. It does not run authenticated routes, modals, full groups, advanced controls, receipt scan, visual parity, or PWA.

## Findings tracker

Severity: **S1** legal or money harm · **S2** wrong or misleading core behavior · **S3** broken secondary flow, accessibility, or permission presentation · **S4** polish.

### Testing

| ID      | Sev | Finding                                                                            | Evidence                                                                                                                                  | Suggested action                                                                          | Status |
| ------- | --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| TEST-01 | S2  | The broad authenticated route spec cannot start                                    | `e2e/authenticated-routes.spec.ts:6` uses `beforeEach((_fixtures, testInfo) => …)`; Playwright requires object destructuring              | Change to `({ page }, testInfo)` and run the project in CI                                | open   |
| TEST-02 | S2  | The accessibility spec fails on every route and covers only 6 desktop light routes | axe found contrast or button-name violations on 16 routes; the Playwright a11y project reports failures for every route                   | Fix the contrast/name defects, then expand to phone, dark, and all routes                 | open   |
| TEST-03 | S2  | The modal spec expects a `View` button that no longer exists                       | `e2e/modal-interactions.spec.ts:26` waits for `table … button "View"`; the table opens rows on click instead                              | Update the test to click the row, or add the intended keyboard-accessible action          | open   |
| TEST-04 | S3  | The group hub test matches a hidden mobile heading                                 | `e2e/loan-groups-v2.spec.ts:52` uses `getByText(name).first()`; the first match is hidden on desktop                                      | Use a visible `getByRole("heading", …)`                                                   | open   |
| TEST-05 | S3  | The receipt-scan AI-off test fails and blocks the rest of a serial project         | Two uploaded receipts produce one row; 7 tests do not run                                                                                 | Reproduce the staging path, then fix the code or the expectation                          | open   |
| TEST-06 | S3  | PWA E2E fails locally and is absent from GitHub CI                                 | 1 passed, 3 failed with `page.reload: ERR_ABORTED`; workflows do not run `test:e2e:pwa`                                                   | Stabilize preview/offline setup and add a CI job                                          | open   |
| TEST-07 | S3  | Visual parity is stale and desktop-only                                            | Investors snapshot is 980px tall vs a 900px baseline; no phone or dark snapshots                                                          | Refresh baselines after fixes; add 390px and dark coverage                                | open   |
| TEST-08 | S3  | Unit tests read the developer `.env.local`                                         | `AI_ENABLED=false` in the local file caused 7 AI tests to fail                                                                            | Stub private env in tests and provide explicit test defaults                              | open   |
| TEST-09 | S3  | The coverage gate protects 4 money files, not the app                              | Gate covers `ledger`, `centavos`, `status`, `interest-period-editor`; full `src/lib` probe is 24.86% lines                                | Add gate tiers for money, dates, schemas, server helpers, and critical forms              | open   |
| TEST-10 | S2  | GitHub CI runs only a small subset of Playwright projects                          | CI runs smoke, money, a11y, one money-health test, and one CRUD test; authenticated, modals, groups, receipt, visual, and PWA are skipped | Split E2E into CI jobs on a disposable database and run the full tagged suite on PRs/main | open   |
| TEST-11 | S3  | No phone, dark-mode, or WebKit coverage                                            | All committed Playwright projects are Chromium desktop except the ad-hoc crawl used here                                                  | Add mobile viewport projects and a WebKit PWA project                                     | open   |
| TEST-12 | S3  | No contract preview/PDF parity test                                                | The missing lender allocation would have failed a parity assertion                                                                        | Compare preview DOM and PDF data for a multi-investor loan                                | open   |
| TEST-13 | S3  | No test compares stored debt installments with the live schedule                   | MONEY-01 shipped with stored 20,711.33 vs live 20,199.70                                                                                  | Add the consistency integration test                                                      | open   |
| TEST-14 | S3  | No test for read-only UI or feature-flag route hiding                              | PERM-01, PERM-03, and FLAG-01 were found by manual crawl                                                                                  | Add persona-based UI assertions and a flag route matrix                                   | open   |
| TEST-15 | S3  | CI data is too thin; many row-dependent tests skip                                 | CI seeds one loan; receipt and party tests skip when no fixture matches                                                                   | Seed a production-like fixture set before browser tests                                   | open   |
| TEST-16 | S4  | No load or payload budget in CI                                                    | Lighthouse is local/non-blocking; no p95 TTFB or payload budget                                                                           | Add a read-only load smoke and record server timings                                      | open   |
| TEST-17 | S4  | No mutation testing                                                                | Optional quality signal for the money engine                                                                                              | Run Stryker monthly on `src/lib/money/**`                                                 | open   |

### Legal and signing

| ID       | Sev | Finding                                                                                                       | Evidence                                                                                                                                                                                                                                             | Suggested action                                                                                                                              | Status |
| -------- | --- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| LEGAL-01 | S1  | Signing preview omits Parties, Lender Allocation, and signature blocks; clauses reference the missing section | `LoanContractPreview.svelte` renders only title, intro, detail rows, and clauses. `LoanContractDocumentBody.svelte` (PDF/editor) renders Parties, Lender Allocation, Terms, and signatures. `/loans/140/sign` as the investor shows no lender block. | Use one contract component for preview, editor, and PDF, or add the missing sections to `LoanContractPreview`. Add a preview/PDF parity test. | open   |
| LEGAL-02 | S2  | Sign-in claims agreement to Terms of Service and Privacy Policy, but no pages or links exist                  | `src/routes/signin/+page.svelte:72` is plain text; `grep` finds no privacy route or link                                                                                                                                                             | Add `/terms` and `/privacy` pages and link them, or remove the claim until the pages exist                                                    | open   |
| LEGAL-03 | S3  | Signed contract preview has no signature or witness blocks                                                    | `LoanContractPreview.svelte` has no signature section; the PDF does                                                                                                                                                                                  | Include the signed blocks in the preview, or state clearly that signatures appear on the final PDF                                            | open   |

Evidence: [sign preview missing lender allocation](../../../reports/qa-audit-2026-11-20/sign-preview-missing-lender-allocation.png)

### Money display and data

| ID       | Sev | Finding                                                                                                                           | Evidence                                                                                                                                                                                                                                                                                                                                                                               | Suggested action                                                                                                                                                                                                                                                 | Status |
| -------- | --- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| MONEY-01 | S2  | Bank loan shows two different monthly amounts: live schedule ₱20,199.70, stored installment and Record payment default ₱20,711.33 | Debt 1 (`Metrobank M Free`, ₱235,000, 0.48% monthly, 12 months). `debt_interest_periods.expected_installment = 20711.33`; live `calculateDebtSummary().schedule[0].periodDue = 20199.70`. The stored value equals the old flat schedule (`235000 / 12 + 1128`); the live value is amortized. Record payment prefills 20711.33. Difference ₱511.63 per period, ₱6,139.59 over the term. | Re-sync all existing debt periods; add a read-only consistency check; drive the payment default and row label from the live schedule until the stored value is trustworthy. Add an integration test that compares every stored installment to the live schedule. | fixed  |
| MONEY-02 | S3  | Legacy debt 1 has its first installment on the start date                                                                         | `due_date 2026-06-25` equals the debt date. Current `generateInterestSchedule` adds one interval (D-9), so the row is stale.                                                                                                                                                                                                                                                           | Include stale due dates in the same re-sync; verify no paid period moves.                                                                                                                                                                                        | fixed  |
| MONEY-03 | S2  | Investor list “Rate” shows total return over the term as a percentage, not an average or periodic rate                            | Arianna Perez shows 110.09%, Michael Manlulu 27.61%, Migui Lapira 110.09%. `calculateAverageRate` returns total interest / total principal. Loan detail calls the same value “Avg. Rate”.                                                                                                                                                                                              | Rename to “Total rate” or “Interest / principal”, or show a true per-period/annual average. Apply the same label to filters, cards, PDF, and CSV.                                                                                                                | fixed  |
| MONEY-04 | S3  | Dashboard “Past Due” lists Overdue loans with ₱0.00 in red                                                                        | Loans 133, 134, 135, 136, 113, 121, 130, 131 are Overdue but show ₱0.00. The local money-health report says loan status matches the ledger, so the card is using a different amount or stale data.                                                                                                                                                                                     | Show the overdue balance for the row and hide zero-balance completed/paid rows, or fix the underlying allocation state. Confirm which amount the card intends to show.                                                                                           | fixed  |
| MONEY-05 | S3  | Local snapshot still contains legacy money anomalies                                                                              | `db:health:money`: 15 receipt-less payments matching a period amount/date, 4 unlinked payments, 1 zero-capital allocation stored as fixed. Status drift and duplicate periods are zero.                                                                                                                                                                                                | Resolve through the existing production-repair plan, not ad hoc SQL. The new QA checks should cover these categories.                                                                                                                                            | open   |

Evidence: [debt amount mismatch](../../../reports/qa-audit-2026-11-20/debt-amount-mismatch.png) · [payment prefill mismatch](../../../reports/qa-audit-2026-11-20/debt-payment-prefill-mismatch.png) · [investor rate label](../../../reports/qa-audit-2026-11-20/investor-rate-label.png)

### Permissions and privacy presentation

| ID      | Sev | Finding                                                                                | Evidence                                                                                                                                                                        | Suggested action                                                                                                                                                                 | Status |
| ------- | --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| PERM-01 | S2  | A read-only witness or group viewer can open Record interest payment and fill the form | Witness session on `/loans/3` shows Pay on every period and opens the full payment sheet. `POST /api/loans/[id]/payments` calls `assertLoanAdmin`, so the save returns 403.     | Hide Pay, Add Witness, bulk select, and management actions when `canAdminEdit` is false. Add a Playwright test that asserts no write controls exist for each read-only persona.  | open   |
| PERM-02 | S3  | Party and group viewers see every co-investor’s capital, notes, and receipt thumbnails | Investor and witness views of `/loans/140` and `/loans/3` show other investors’ sections and notes such as “Only 9k received instead of 15k…”. Group copy says PII is redacted. | Decide whether co-investor money is intentionally shared. If not, project only the viewer’s slot plus aggregate totals. If yes, document it in the money model and route guides. | open   |
| PERM-03 | S3  | Bulk selection is visible in the Invested tab for a party user                         | Investor table screenshot shows the select-all and row checkboxes even though the user cannot manage the loans                                                                  | Gate `canBulkSelect` on `canManage`, not only on scope                                                                                                                           | open   |

### Feature flags and reachable dead flows

| ID      | Sev | Finding                                                                                           | Evidence                                                                                                                                                                                    | Suggested action                                                                                                    | Status |
| ------- | --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| FLAG-01 | S3  | `/transactions` is reachable while `SHOW_TRANSACTIONS_UI=false` and shows a developer instruction | `src/routes/transactions/+page.server.ts` has no flag guard; `+page.svelte:189-192` prints “Set SHOW_TRANSACTIONS_UI to enable nav links.” `/transactions/new` and detail routes also load. | Throw a 404 or redirect when the flag is off, and hide the transaction APIs behind the same flag. Add a route test. | open   |
| FLAG-02 | S4  | The `SHOW_TRANSACTIONS_UI` state leaks into user-facing copy                                      | Landing and footer swap “transactions” to “bank loans” correctly, but the route itself exposes implementation language                                                                      | Remove developer copy from all user-visible surfaces                                                                | open   |

Evidence: [transactions flag message](../../../reports/qa-audit-2026-11-20/transactions-flag-message.png)

### Accessibility

| ID      | Sev | Finding                                                                         | Evidence                                                                                                                                                                                               | Suggested action                                                                                                         | Status |
| ------- | --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| A11Y-01 | S3  | Avatar fallback “MM” fails contrast on every authenticated page, light and dark | axe serious `color-contrast`, target `#bits-s7 …[data-slot="avatar-fallback"]` on all 16 routes. White on `#fb9f44` is about 2.1:1.                                                                    | Use dark ink on the orange tile for fallbacks, or darken the tile. Keep primary buttons legible too.                     | open   |
| A11Y-02 | S2  | Filter comboboxes have no accessible name                                       | axe critical `button-name` on `/loans/new` (template “None”), `/debts` (“All Periods”), `/transactions` (“All Directions”). The elements are `role="combobox"` without `aria-label`/`aria-labelledby`. | Add labels (“Filter by period”, “Filter by direction”, “Loan template”) and test with axe.                               | open   |
| A11Y-03 | S2  | Clickable loan table rows are not keyboard reachable                            | `LoansTable.svelte` row has `onclick` only; no `tabindex`, role, or key handler. svelte-check reports `a11y_click_events_have_key_events` and `a11y_no_static_element_interactions`.                   | Open the row from a real button/link, or add `tabindex="0"`, `role="button"`, Enter/Space handling, and visible focus.   | open   |
| A11Y-04 | S3  | Muted labels and chart-colored values fail contrast; dark mode is worse         | axe serious on 16 routes: `.lg:inline`, `.text-chart-2/3/5`, `.text-primary`, and destructive badges. Debt detail has 11 nodes in light mode.                                                          | Adjust semantic tokens for `muted-foreground`, chart colors, primary, and destructive badge text. Verify in both themes. | open   |
| A11Y-05 | S3  | Landing mobile theme and menu buttons have no accessible name                   | Landing mobile button list shows `" "` and `""` for the theme and menu controls                                                                                                                        | Add `aria-label="Toggle theme"`, `aria-label="Open menu"`, `aria-label="Close menu"`                                     | open   |

Evidence: [dark mode contrast](../../../reports/qa-audit-2026-11-20/dark-mode-contrast.png)

### Desktop and mobile UX

| ID    | Sev | Finding                                                                                        | Evidence                                                                                                                             | Suggested action                                                                                                                | Status |
| ----- | --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| UX-01 | S3  | Loan scope tabs clip the last label on a 390px phone                                           | “Commissioned” renders as “Commissione…” with no fade or scroll hint                                                                 | Make the tab row scrollable with a visible edge fade, shorten the labels, or move the overflow into a menu                      | open   |
| UX-02 | S3  | Floating “Today” button covers timeline cards on desktop and phone                             | `LoanTimelineView.svelte:306` is `position: fixed` at `bottom-6` / above the dock; no bottom padding is reserved in the timeline     | Put Today in the timeline header, or reserve bottom space so it never covers a row                                              | open   |
| UX-03 | S3  | Bank loan rate is rendered with six decimals                                                   | `/debts` and `/debts/1` show `0.480000%`, `1.860000%`                                                                                | Format with a sensible maximum of 2–4 decimals and trim trailing zeros                                                          | open   |
| UX-04 | S4  | Bank loan start date omits the year on the list                                                | `/debts` shows “Jun 25” and “Oct 3”; detail shows “Jun 25, 2026”                                                                     | Use the same date format as the detail and the rest of the app                                                                  | open   |
| UX-05 | S3  | Group “Upcoming” includes loans whose due dates are in the past                                | `/groups/1` shows Nov 15, Oct 6, Oct 13, and Oct 28 under Upcoming. `upcomingLoans` filters only `isOpenLoan` and sorts by due date. | Filter to `dueDate >= today`, or rename the card to “Open loans” and show an overdue marker                                     | open   |
| UX-06 | S3  | Group “Next due” can be a past date                                                            | `/groups` and `/groups/1` show “Next due Nov 15, 2026” on Nov 20                                                                     | Use “Next due” only for future dates; otherwise show “Overdue since …”                                                          | open   |
| UX-07 | S3  | Group Loans tab totals look wrong beside the group header                                      | Header says 33 loans; Loans tab says “Showing 1 of 1 loans” and ₱550k because the default November range filters the list            | Make the active date range more prominent, or default the group tab to all-time; keep the header and tab definitions aligned    | open   |
| UX-08 | S3  | Storage-backed images render as broken images with alt text, not a fallback                    | Settings valid ID and e-signature previews, investor receipts, and disbursement receipts return 503 when R2 is not configured        | Add an empty/error state with a neutral placeholder and a retry or Replace action; do not surface the browser broken-image icon | open   |
| UX-09 | S4  | Push preference toggles are active while push is unavailable                                   | Settings says “Push is unavailable until VAPID keys are configured” but still allows edits and Save                                  | Disable the controls and explain which server setup is missing, or hide the card                                                | open   |
| UX-10 | S3  | New loan form defaults the due date to today                                                   | `/loans/new` pre-fills `11/20/2026`; a loan saved without changing it starts overdue                                                 | Default to a sensible future date (for example +14 days) or require confirmation when due today/past                            | fixed  |
| UX-11 | S4  | Full-page loan form has no actions in the phone top bar                                        | `/loans/new` on phone shows only the brand bar; Cancel/Create are at the bottom of a long form                                       | Keep primary actions in the top bar, or add a sticky footer                                                                     | open   |
| UX-12 | S4  | Signing page has no sticky action while the contract is very long                              | Signer must scroll the entire contract on phone before reaching the signature pad and consent                                        | Add a sticky “Review and sign” jump or a two-step layout (review → sign)                                                        | open   |
| UX-13 | S4  | Settings is a very long single column with no section navigation                               | Full-page screenshot: Account, templates, identity, signature, methods, health, deleted, install, notifications, maintenance         | Add section anchors or a compact settings index on desktop                                                                      | open   |
| UX-14 | S4  | Mobile dashboard keeps the page description, contrary to the “descriptions hide under lg” rule | “Overview of your lending performance and upcoming activity.” wraps to two lines on phone                                            | Hide descriptions under `lg`, or shorten them to one line                                                                       | open   |
| UX-15 | S4  | Timeline month label wraps in a narrow rail                                                    | Desktop timeline shows “November” / “2026” on two lines                                                                              | Give the rail enough width or use a short month label                                                                           | open   |

Evidence: [timeline Today overlap](../../../reports/qa-audit-2026-11-20/timeline-today-overlap.png) · [mobile scope tabs clipped](../../../reports/qa-audit-2026-11-20/mobile-scope-tabs-clipped.png) · [group upcoming past](../../../reports/qa-audit-2026-11-20/group-upcoming-past.png) · [settings broken previews](../../../reports/qa-audit-2026-11-20/settings-broken-storage-previews.png)

### Code health

| ID      | Sev | Finding                                                                                                                                 | Evidence                                                                                                                                                                        | Suggested action                                                                                  | Status |
| ------- | --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------ |
| CODE-01 | S3  | Form state captures initial props and ignores later changes, producing `state_referenced_locally` warnings across detail and edit flows | 100 svelte-check warnings in 38 files, for example `WitnessDetailClient.svelte:20-21`, `DebtDetailClient.svelte:28-29`, `WitnessForm.svelte:45-49`, `TransactionForm.svelte:42` | Convert captured values to `$derived` or keyed local state; add navigation-between-entities tests | open   |
| CODE-02 | S4  | Large components remain hard to test                                                                                                    | `LoanForm.svelte` (~424 statements), `LoanListPage.svelte` (~377), `InvestorDetailContent.svelte` (~293), `CreateGroupWizard.svelte` (~248) all report 0% unit coverage         | Extract sections and state modules incrementally, starting with the payment and settings panels   | open   |
| CODE-03 | S4  | Hidden duplicate controls and headings remain in the DOM                                                                                | Loan detail has two `Back` buttons and two `H1`s at 1440px; the loans table has two signing buttons per row                                                                     | Keep the inactive shell out of the accessibility tree and the DOM, or mark it `aria-hidden`       | open   |

## Deep flow pass (2026-11-21)

A second pass exercised the actual create/edit/pay/delete/sign journeys against the local snapshot. These are new findings from that pass; they are not duplicates of the crawl findings above.

### New findings

| ID      | Sev | Finding                                                                                                                                                                       | Evidence                                                                                                                                                                                                                                                                                                                                                 | Suggested action                                                                                                                                                                                                                                                   | Status |
| ------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| DEEP-01 | S2  | Fund Transfer does not refresh the loan detail; the new tranche is invisible until reload, and the new allocation is stored with `hasMultipleInterest=true` but zero periods  | Loan 174 (₱60,000, 5 periods). Fund Transfer of ₱10,000 left the page at ₱60,000 principal. A fresh reload showed ₱70,000, two disbursements, and ₱7,000 interest. The API stores allocation 694 with `hasMultipleInterest=true` and `interestPeriods=[]`; the ledger uses the existing schedule and applies the total capital.                          | Fix the stale detail with DEEP-04. Decide whether a new tranche should own a schedule; if not, store `hasMultipleInterest=false` or document the shared schedule. Add a test that reloads after a transfer and checks principal, disbursement count, and interest. | fixed  |
| DEEP-02 | S2  | Saving a loan template crashes after Due in (days) or Free lot (sqm) is edited (`TypeError: termDays.trim is not a function`); template save is unreliable                    | Settings → Loan templates → Add, change “Due in (days)” from 14 to 30, fill the form, click Save. No request is sent; console shows the TypeError at `LoanTemplatesManager.svelte:181`. The default value saves, so a numeric edit triggers the crash.                                                                                                   | Coerce numbers safely before `.trim()` (or keep the state as strings). Add a component test that changes term and lot values, then saves and edits.                                                                                                                | fixed  |
| DEEP-03 | S2  | Received-payment deletion is unreachable: the trash icon sets state but `ConfirmDeleteDialog` is never rendered; single-interest payments have no edit/delete controls at all | `InvestorTransactionsDisplay.svelte` imports `ConfirmDeleteDialog` and defines `performDeleteReceivedPayment`, but has no `<ConfirmDeleteDialog>` in markup. Clicking Remove payment leaves both payments in the database. Single-interest “Payments received” rows have no actions.                                                                     | Render the dialog and wire `onConfirm`; add edit/delete buttons to single-interest rows. Test delete → period status reverts.                                                                                                                                      | fixed  |
| DEEP-04 | S2  | After Add Received Payment, the detail page shows old totals until a full reload                                                                                              | Loan 172: API and toast show ₱55,000 received and `Completed`; the page still shows Total Received ₱0.00, Balance ₱55,000, Fully Funded. Fresh navigation shows the correct values. `src/routes/loans/[id]/+page.server.ts` never calls `event.depends('app:loans')`, so `invalidate('app:loans')` does not rerun the detail load.                       | Add the dependency or `invalidateAll()` after detail mutations. Add a Playwright test that records a payment and asserts the summary updates without reload.                                                                                                       | fixed  |
| DEEP-05 | S2  | Multi-interest creation is blocked unless the hidden One Time Interest rate is filled first                                                                                   | Switch to Multiple Interest, fill all five period rates, add a receipt, click Create. No request; toast says “Each transaction needs an interest rate or fixed amount.” Filling the one-time rate first makes the save work.                                                                                                                             | In multiple mode, derive/disable the transaction-level rate or skip its validation. Show the required field if it is still required.                                                                                                                               | fixed  |
| DEEP-06 | S2  | Edit form displays periods out of order and labels the wrong period “Final”                                                                                                   | Loan 174 edit form shows Period 1 due Mar 31, Period 2 Dec 31, Period 3 Nov 30, Period 4 Jan 31, Period 5 (Final) Feb 28. Date input IDs map in the same unsorted order. The `Final` badge is positional, not the latest date.                                                                                                                           | Sort by due date on load; make the maximum due date the final period; make labels and lock state follow the sorted order. Add a regression test with unsorted API input.                                                                                           | fixed  |
| DEEP-07 | S2  | Group “Add loans” has no Review or Add control when the sheet fetches its own list                                                                                            | Group 9 → Add loans. The footer only renders action buttons when `availableLoans.length > 0`; the detail page passes no `availableLoans`, so the fetched list shows only Cancel/Close. Selecting a loan leaves no way to continue.                                                                                                                       | Gate the footer on the loaded choices, not the optional prop. Add a test that opens the sheet from a group and adds one loan.                                                                                                                                      | open   |
| DEEP-08 | S2  | Group wizard preselects every loan and the investor filter does not restrict the list                                                                                         | Step 1 choose Investor → Arianna Perez. Step 2 opens with “47 selected” and lists loans from Romina, Precious, and others.                                                                                                                                                                                                                               | Do not select all by default. Apply the investor/borrower filter to the step-2 list, or clearly label “All loans” and require explicit selection.                                                                                                                  | open   |
| DEEP-09 | S3  | Contact deletion leaves orphan auth users; malformed email is accepted; validation failures return 500                                                                        | `POST /api/investors` with `email: "not-an-email"` returns 201 and creates a `users` row. Whitespace name and one-character name return 500 “Failed to create …”. Deleting the contact leaves the user behind (13 audit users remained after party rows were deleted).                                                                                   | Validate email format, return 400 with a field message, and deactivate/delete the linked party user when a contact is deleted (or document retention).                                                                                                             | open   |
| DEEP-10 | S3  | Loan table renders every row; no pagination at desktop                                                                                                                        | 128 loans with a 2026 range produced 128 `<tr>` elements and no page controls. Investor tables do paginate.                                                                                                                                                                                                                                              | Reuse the shared pagination for the table view (for example 25/50 per page) or add explicit “show more”. Measure first paint with 500+ rows.                                                                                                                       | open   |
| DEEP-11 | S3  | Duplicate previously lost contract customization and groups; explicit witnesses and commissions are not copied by design                                                      | Saved contract title “Audit Contract Title”; duplicate form shows the default “Loan Agreement with Security”. `createDuplicateDataFromLoan` can copy customization only when `loan.loanContract` is loaded; the detail load omits it. Contract customization and groups are now copied; explicit witnesses and commissions are intentionally not copied. | Load contract data before duplicate, include groups/witnesses (or offer a checklist), and state what is copied. Add a duplicate test.                                                                                                                              | fixed  |
| DEEP-12 | S3  | Single-interest loans have no visible Pay action                                                                                                                              | The only path is the ⋯ menu → Add Received Payment. The “Single repayment” card is a summary with no button.                                                                                                                                                                                                                                             | Add a Pay button on the single-repayment card, or make the row action obvious.                                                                                                                                                                                     | fixed  |
| DEEP-13 | S4  | Create Loan always opens the Contract details modal, covering the new loan                                                                                                    | After create, `/loans/[id]?signing=1` opens the large “Contract details · 0 of 2 signed” modal before the user can read the summary.                                                                                                                                                                                                                     | Open the signing prompt only when the owner asks, or use a small “Contract ready” banner with a Details link.                                                                                                                                                      | open   |
| DEEP-14 | S4  | PDF export is the only export in the list menu                                                                                                                                | The Export menu offers “Export All Data” and “Export Filtered Data”, both PDF. No CSV control is exposed, although the codebase and docs still refer to CSV columns.                                                                                                                                                                                     | Either add CSV export beside PDF or remove the stale CSV references from docs.                                                                                                                                                                                     | open   |
| DEEP-15 | S4  | Group wizard review uses cryptic “D-7 / D-3 / D-1” channel labels                                                                                                             | Review step labels for Telegram reminder windows.                                                                                                                                                                                                                                                                                                        | Use “7 days before / 3 days before / 1 day before”.                                                                                                                                                                                                                | open   |

### What worked end to end

- Party create, edit, and delete via the UI; blocked delete for a borrower with loans.
- Payment method add with inline validation, save, list formatting, and delete.
- Bank loan create with live schedule; stored installment and live schedule agree for a new debt; partial payment updates the summary and status correctly.
- Contract editor tabs, contract title save, and PDF download.
- Loan PDF export (filtered and all), backup JSON download, data-health check, and recently-deleted list.
- Loan duplicate form prefill, delete, and restore.
- Signing as both investor and borrower: signature drawing, consent, 2/2 signed, signed-state reopen, and owner confirmation. The missing lender block remains LEGAL-01.
- Group wizard create, review access, rename, and delete; group tabs and channel status render.
- Existing template apply (borrower/investor/rate/due/name prefill), despite the broken template save.

### Evidence

[Screenshot index for the deep pass](../../../reports/qa-audit-2026-11-20/deep/):

| File                                  | Shows                                                           |
| ------------------------------------- | --------------------------------------------------------------- |
| `fund-transfer-hidden-allocation.png` | ₱10,000 transfer applied but summary stays ₱60,000 until reload |
| `template-save-noop.png`              | Template dialog after Save with no request                      |
| `group-add-loans-no-submit.png`       | Add loans sheet with only Cancel                                |
| `group-wizard-all-selected.png`       | 47 loans selected on step 2                                     |
| `edit-period-order.png`               | Period 1 Mar 31, Period 5 (Final) Feb 28                        |
| `single-payment-stale-detail.png`     | Stale ₱0 received after a ₱55,000 payment                       |
| `single-payment-after-reload.png`     | Correct totals after reload                                     |
| `multi-payment-controls.png`          | Multi-interest payment edit/remove controls                     |
| `loan-table-rate-and-pagination.png`  | 128 rows, 120%+ “Rate”, no pagination                           |
| `sign-investor-success.png`           | Signed confirmation for the investor                            |

## Recommended test suite

The goal is not “more tests.” It is one test per risk, placed at the cheapest layer that reproduces the risk.

### Phase 0: restore trust in the suite (P0)

| Task    | What to do                                                                                                      | Acceptance                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| QA-0.1  | Fix `e2e/authenticated-routes.spec.ts` (`beforeEach(({ page }, testInfo) => …)`) and run it against a seeded DB | Project passes; every listed route returns 200 and has a visible H1                          |
| QA-0.2  | Remove or update the stale `View` button expectation in `modal-interactions.spec.ts`                            | Quick-view, new-loan, bank-loan, fund-transfer, and contract stacking tests pass             |
| QA-0.3  | Fix the group hub heading locator to target visible headings                                                    | `loan-groups-v2` passes at 1440 and 390                                                      |
| QA-0.4  | Reproduce the receipt-scan “AI off” failure; decide whether it is a code regression or a stale expectation      | Two receipt files always produce two blank rows in AI-off mode, and the test is stable       |
| QA-0.5  | Make tests independent of `.env.local` (`vi.stubEnv`, per-test env, explicit defaults)                          | `AI_ENABLED=false` in the developer file cannot change the unit result                       |
| QA-0.6  | Make PWA tests deterministic in preview; fix or quarantine the reload race                                      | `test:e2e:pwa` passes locally and in CI, or is explicitly marked flaky with a tracking issue |
| QA-0.7  | Refresh visual baselines after the UI fixes, and add a documented update command                                | Visual parity passes on a clean checkout with the seed data                                  |
| QA-0.8  | Add a component test that saves and edits a loan template with numeric term and lot fields                      | DEEP-02 cannot return                                                                        |
| QA-0.9  | Add a Playwright test for the group “Add loans” sheet opened from a group                                       | The sheet exposes Review and Add to group and the loan count increases                       |
| QA-0.10 | Add a period-order regression test with unsorted API input                                                      | Periods render in date order and only the latest date is labeled Final                       |

### Phase 1: protect the core journeys (P1)

| Task    | Test to add                                                                                                                                                                                            | Why                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| QA-1.1  | Route smoke matrix: every `src/routes/**/+page.svelte`, at 1440 and 390, owner + anonymous, asserts status, H1, no console error, no `NaN`/`Infinity`, no horizontal overflow                          | Catches dead links, crashes, broken redirects, and layout regressions in one place |
| QA-1.2  | Contract parity test: for a multi-investor loan, compare the signing preview DOM, the editor DOM, and the PDF data. Assert Parties, Lender Allocation, interest, totals, and signatures are present    | Prevents LEGAL-01 from returning                                                   |
| QA-1.3  | Debt consistency integration test: for every debt, compare each stored `expected_installment` and `due_date` with `calculateDebtSummary`; assert the Record payment default equals the live period due | Prevents MONEY-01 from returning                                                   |
| QA-1.4  | Read-only UI matrix: investor, borrower, witness, group viewer, unrelated user. Assert no Pay, Add Witness, bulk select, or edit actions; open each visible action and confirm it is allowed           | Prevents PERM-01/PERM-03                                                           |
| QA-1.5  | Feature-flag route test: with `SHOW_TRANSACTIONS_UI=false`, `/transactions`, `/transactions/new`, and detail return 404/redirect                                                                       | Prevents FLAG-01                                                                   |
| QA-1.6  | Storage fallback test: stub `/api/storage/object` to 503 and assert a placeholder appears, no browser broken image, and no unhandled console error                                                     | Prevents UX-08                                                                     |
| QA-1.7  | Signing flow test: draw a signature, check consent, assert the submit button enables; assert the full contract sections are visible before submit                                                      | Covers the highest-risk user journey                                               |
| QA-1.8  | Money flow: create a multi-interest loan, add a Fund Transfer, assert the new principal is visible and an interest schedule exists for it                                                              | Prevents DEEP-01                                                                   |
| QA-1.9  | Payment flow: add a received payment on a single-interest loan, assert the summary updates without reload; edit and remove a payment with confirmation                                                 | Prevents DEEP-03 and DEEP-04                                                       |
| QA-1.10 | Group flow: from a created group, open Add loans, select one loan, Review, Add to group, then remove it                                                                                                | Prevents DEEP-07                                                                   |

### Phase 2: accessibility and mobile (P1/P2)

| Task   | Test to add                                                                                             | Why                                           |
| ------ | ------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| QA-2.1 | axe scan on all routes, desktop + phone, light + dark                                                   | Today only 6 routes at 1440 light are scanned |
| QA-2.2 | Keyboard test: tab through the loan list, open a row with Enter, close with Escape; tab through filters | Covers A11Y-03 and focus return               |
| QA-2.3 | Mobile visual snapshots for dashboard, loans, loan detail, settings, sign, and account sheet            | Today only 1440×900 light is snapshotted      |
| QA-2.4 | WebKit project for the PWA and mobile journeys                                                          | iOS is a primary target and is untested       |
| QA-2.5 | Contrast token test for avatar, muted text, chart colors, primary, and destructive badges               | Makes the fixes measurable                    |

### Phase 3: coverage and CI (P2)

| Task   | What to do                                                                                                                                                       | Acceptance                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| QA-3.1 | Expand the coverage gate from four money files to `src/lib/money/**`, `src/lib/loans/**`, `src/lib/dates/**`, `src/lib/schemas/**`, and the server route helpers | A realistic threshold (for example 80% lines on those paths) passes locally and in CI |
| QA-3.2 | Add component tests for `LoanForm`, `DebtForm`, `InvestorForm`, `BorrowerForm`, `WitnessForm`, settings cards, and the group wizard                              | Each form covers happy path, validation, and one failure path                         |
| QA-3.3 | Add API contract tests for every mutating route (status codes, schema rejection, ownership, idempotency)                                                         | No route can change without a failing test                                            |
| QA-3.4 | Run the full Playwright suite on a disposable Postgres in CI, split into `smoke`, `money`, `crud`, `groups`, `receipt`, `a11y`, `visual`, `pwa` jobs             | PRs show a real browser signal, not just smoke                                        |
| QA-3.5 | Seed a production-like fixture set (multi-investor, multi-period, fixed, agent, overdue, completed, group, debt) before E2E                                      | Data-dependent tests stop skipping in CI                                              |
| QA-3.6 | Add a load smoke test for `/dashboard`, `/loans`, `GET /api/loans`, and one detail route                                                                         | p95 TTFB and payload budget are recorded                                              |
| QA-3.7 | Optional monthly mutation test on `src/lib/money/**`                                                                                                             | Test strength, not just line coverage                                                 |

## UI/UX improvement backlog

Ordered by user impact, not by effort.

1. **Signing clarity.** Full contract preview, clear signer role, sticky review/sign action, and a printed/PDF match.
2. **Money labels.** “Rate” must say what it means. Separate per-period rate, total rate, and fixed amount. Add a short tooltip on the investor list and loan summary.
3. **Read-only mode.** Hide actions that cannot succeed. If an action is shown, it should work or explain why it is disabled.
4. **Empty and failed states.** Storage images, push, calendars, Telegram, and deleted data all need a designed fallback.
5. **Filters and date ranges.** Make the active range unmistakable on group and loan lists. Add a “showing X of Y in range” line.
6. **Mobile list chrome.** Scope tabs, filter trigger, view toggle, and Today control should not fight the content.
7. **Group hub truth.** “Upcoming” means future. Use “Open loans” or “Earliest due” when the date is in the past.
8. **Settings navigation.** Section index, consistent card titles, no developer copy, no duplicate template labels.
9. **Landing polish.** Legal links, accessible icon buttons, and a no-JS/print-safe reveal fallback.
10. **Date and number formatting.** One format for dates (year included when space allows), one for percentages (max 2–4 decimals), one for money.

## Fix order and release gates

### Release blockers

- LEGAL-01: signing preview must match the contract.
- MONEY-01: debt installment and payment default must match the live schedule.
- DEEP-01: Fund Transfer must refresh the detail and make the new tranche visible; decide the period policy.
- DEEP-02: loan templates must save without a client crash.
- DEEP-03: received payments must be editable/removable, with a confirmation.
- DEEP-04: the loan detail must refresh after a payment.
- DEEP-06: period order and the “Final” label must follow the due dates.
- DEEP-07: group Add loans must have a working review/add action.
- A11Y-02 and A11Y-03: unlabeled core filters and keyboard-inaccessible loan rows.
- TEST-01: the broad authenticated smoke suite must run again.
- LEGAL-02: legal pages exist or the claim is removed.

### Before the next production release

- PERM-01/PERM-03: no write controls for read-only users.
- FLAG-01: transactions route is gated or removed.
- A11Y-01/A11Y-04: contrast fixes and a passing axe matrix.
- UX-01, UX-02, UX-05, UX-06, UX-07, UX-08.
- MONEY-03: metric naming.
- TEST-10: CI runs the money, CRUD, groups, authenticated, a11y, and PWA projects.

### Follow-up

- Coverage expansion, component tests, WebKit, mobile visual snapshots, load tests.
- Settings and landing polish.
- Mutation testing and performance budgets.

## Open questions

| ID  | Question                                                                             | Default if no decision                                                            |
| --- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Q-1 | Should a party viewer see co-investor capital, notes, and receipts?                  | Hide other investors’ private money; show only the viewer’s slot plus loan totals |
| Q-2 | Is “Rate” on the investor list a total return, a per-period rate, or an annual rate? | Rename to “Total rate” until a product definition exists                          |
| Q-3 | Should a loan created with a due date of today be allowed?                           | Block with a confirmation and default due date to +14 days                        |
| Q-4 | Is a completed loan allowed to have an unsigned contract?                            | Show “Completed, contract unsigned” and keep the signing CTA                      |
| Q-5 | Should `/transactions` be deleted completely or kept behind the flag?                | Keep code but return 404 when the flag is off                                     |
| Q-6 | Does the group viewer projection intentionally include notes and receipts?           | Redact notes and receipt images for group viewers                                 |

## Appendix: reproduction notes

### Local setup used for this audit

```
# Local Postgres on 127.0.0.1:5433
docker compose up -d

# Read-only restore from the 2026-11-16 dump into local Postgres
bun run db:local:sync-prod --from-dump ~/Backups/kame-lends/kame-lends-neon-20261116-135915.dump

# Local dev server
bunx vite dev --strictPort --port 3200
```

`.env.local` used a local `DATABASE_URL`, a local `AUTH_SECRET`, `E2E_AUTH_SECRET=e2e-local-secret`, and `PUBLIC_APP_URL=http://localhost:3200`. It is gitignored and contains no production credentials.

### Useful commands for the follow-up

```
bun run check
bun run lint
bun run test:unit
bun run test:coverage
bun run test:unit:tz
bun run test:integration
bun run build
bun run db:health:money
bun run test:e2e -- --project=setup --project=authenticated
bun run test:e2e -- --project=setup --project=a11y
bun run test:e2e -- --project=setup --project=money-flows
bun run test:e2e:pwa
```

### Screenshot index

All images are in [`reports/qa-audit-2026-11-20/`](../../../reports/qa-audit-2026-11-20/).

| File                                         | Shows                                                               |
| -------------------------------------------- | ------------------------------------------------------------------- |
| `sign-preview-missing-lender-allocation.png` | Signing contract preview with no Parties or Lender Allocation block |
| `debt-amount-mismatch.png`                   | Bank loan summary ₱20,199.70 vs Amount due ₱20,711.33               |
| `debt-payment-prefill-mismatch.png`          | Record payment defaulting to ₱20,711.33                             |
| `investor-rate-label.png`                    | Investor list with 110.09% and 120.00% “Rate”                       |
| `timeline-today-overlap.png`                 | Floating Today button covering a timeline card                      |
| `mobile-scope-tabs-clipped.png`              | “Commissioned” clipped on a 390px phone                             |
| `group-upcoming-past.png`                    | Group “Upcoming” listing October and November past dates            |
| `settings-broken-storage-previews.png`       | Broken valid ID and e-signature previews                            |
| `dark-mode-contrast.png`                     | Low-contrast muted labels in dark mode                              |
| `transactions-flag-message.png`              | Developer instruction on the public Transactions route              |

## Tooling note: Vercel Agent

Vercel Agent (public beta on Pro and Enterprise) is useful for the parts of this audit that touch deployments and production signals:

- **Investigations** can analyze runtime errors, failed deployments, and cost or performance anomalies with project logs and metrics.
- **Code Review** can review PRs for security, logic, and performance issues in a sandbox.
- **Security Review** scans pushes for vulnerabilities.
- It is read-only by default and presents a scoped plan before changing Vercel resources.

It is not a replacement for the browser crawl and persona QA above. Use it alongside this plan for production investigations and PR review, not as the only QA layer.
