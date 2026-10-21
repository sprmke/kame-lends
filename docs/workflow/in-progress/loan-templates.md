---
title: "Loan templates"
status: planned
tags: [loans, settings]
updated: 2026-10-21
stage: in-progress
kind: plan
---

# Loan templates

**Goal:** Each user can save loan templates and start a new loan from one, so repetitive fields are filled and the few fields that change stay editable.

**Architecture:** One `loan_templates` row per template, owned by `user_id`. No seed data. Settings manages them, including the usual borrowers and investors. Create Loan loads the signed-in user's templates and applies one on top of the existing form. Template people are switches. Receipt scan still fills principal. Amount, sent date, and due date stay on the loan form.

**Tech stack:** SvelteKit, Drizzle, existing `LoanForm` and `ResponsiveModal`.

## What the current loans repeat

Read-only aggregates on the live book (113 loans):

| Pattern        | What repeats                                                                                                                                               | What changes                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Agent (71)     | Borrower (Romina, Aileen, and others), group (`Agent - Romina`, `Agent - Aileen`), type Agent, interest mode **10% rate**, name `Agent Loan (start - end)` | Investor, principal, the actual dates |
| OR/CR (16)     | Often the same borrower and a ~14 day span, rate 10%                                                                                                       | Name, amount, dates                   |
| Lot Title (26) | Type, rate mode 10%                                                                                                                                        | Name, borrower, long due date         |

The name's date range matches the first sent date and the due date (`Agent Loan (Oct 21 - Nov 5)` is sent 2026-10-21, due 2026-11-05). Disbursements are marked paid. Sent date already defaults to today. Rate already defaults to 10% in the form, but it is not saved as a reusable preset.

Do **not** insert these as default templates. The owner creates them in the app.

## Template fields

Saved:

- Template name (the preset label, e.g. Agent Romina)
- Loan name. `{sent}` and `{due}` fill from the sent date and due date. Agent defaults to `Agent Loan ({sent} - {due})`. Lot Title and OR/CR use the same date pair with their type as the prefix. The form shows a resolved example under the field. Changing type replaces the name while it still matches the previous type's pattern.
- Name mode is stored, not shown. Tokens set `date_range`. A name with no tokens stays `static`. Older prefix-only date-range rows still expand to `prefix ({sent} - {due})`.
- Type: Lot Title, OR/CR, Agent
- Borrowers (optional, must belong to the user). A loan still has one borrower. The template stores the usual borrowers. Create mode shows them as switches in the Borrower column beside Loan name, with the first one on. Unchecking the selected borrower hides the switches and shows the borrower dropdown.
- Investors (optional, must belong to the user). Each has a rate, defaulting to the template rate. Create mode shows them as switches, all on, and turning one off removes that investor.
- Group ids (optional, must be groups the user created)
- Interest type `rate` or `fixed`, and the value (default 10)
- Term in days. The form starts at 14 (due two weeks after the sent date, which is today on the loan form). Clearing it leaves the due date alone. On apply, a saved term sets due date to today plus that many days.
- Notes (optional)
- Free lot sqm (optional, Lot Title only)

Not saved: principal, receipts, sent date, due date override, witnesses, contract text, status. Groups already apply default witnesses on save. Sent date stays today until a receipt or the user changes it. Receipt upload still sets the amount.

Names with `{sent}` and `{due}` update from the first disbursement sent date and the loan due date until the user edits the name: `Agent Loan ({sent} - {due})` becomes `Agent Loan (Oct 21 - Nov 5)`. Same month drops the second month (`Oct 12 - 20`). September is `Sept`. The template form no longer has a dates checkbox.

## Scope

In: per-user CRUD, Settings card, template picker on create only, backup export, docs.

Out: seeded templates, applying a template while editing or duplicating, changing receipt scan itself.

## Tasks

- [x] Migration `db/migrations/0033_loan_templates.sql` and `loanTemplates` in `src/lib/server/db/schema.ts`. Columns above. Unique `(user_id, name)`. Borrower `ON DELETE SET NULL`. No seed.
- [x] `src/lib/loan-templates.ts`: types, `formatDatedLoanName`, `addIsoDays`, `parseLoanTemplateInput`, max 40. Unit tests in `src/lib/loan-templates.test.ts`.
- [x] `src/lib/server/loan-templates.ts` plus `GET/POST /api/loan-templates` and `PATCH/DELETE /api/loan-templates/[id]`. Session user only. Reject borrowers or groups the user does not own.
- [x] Settings card `LoanTemplatesManager.svelte` on `/settings` (after Account). Add, edit, delete. Form in `ResponsiveModal` (sheet under `lg`, `deferBody` off). Due in days and rate are one column. Borrowers and investors are multi-selects (sheet on phone, popover on desktop). Chosen people are listed under the field, and each investor row keeps a rate. Delete uses the existing alert dialog.
- [x] `LoanForm.svelte` create mode: load templates, picker when the list is not empty. **New Loan** is a menu when templates exist (blank loan, or a template). Apply sets borrowers, investors, type, groups, notes, free lot, rate, optional due date, and the name. All of those stay editable. Edit and duplicate hide the picker.
- [x] Include `loanTemplates` in `fetchBackupDataForUser`.
- [x] Docs: `docs/PROJECT.md`, `docs/guides/routes/settings.md`, `docs/guides/routes/loans.md`.

## Docs to update

- `docs/PROJECT.md`
- `docs/guides/routes/settings.md`
- `docs/guides/routes/loans.md`

## Open questions

None.
