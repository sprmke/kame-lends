---
title: "Workflow docs"
status: active
tags: [workflow, docs]
updated: 2026-10-17
kind: reference
---

# Workflow docs

| Stage       | Folder                           | Naming                           | When to use                                                                                   |
| ----------- | -------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| Intake      | [`intake/`](./intake/)           | `<slug>-design.md` + scratchpads | Active design specs and the **`_to-prompt.md`** / **`_to-plan.md`** scratchpads               |
| Planned     | [`planned/`](./planned/)         | `<slug>.md`                      | Approved plan, **not started**                                                                |
| In progress | [`in-progress/`](./in-progress/) | plan + `-design.md` spec         | **Work started**, plan not fully complete (partial phases stay here until the plan is closed) |
| For testing | [`for-testing/`](./for-testing/) | plan + `-design.md` spec         | **Implementation complete**, manual QA only; move to `done/` after the checklist passes       |
| Done        | [`done/`](./done/)               | plan + `-design.md` spec         | Plan **fully complete** (`/workflow-done`)                                                    |
| Won't do    | [`wont-do/`](./wont-do/)         | plan + `-design.md` spec         | Cancelled or rejected (`/workflow-wont-do`)                                                   |
| QA findings | [`qa/`](./qa/)                   | `<slug>.md`                      | Manual QA checklists and live QA notes. Not a stage                                           |

**Scratchpad emojis:** ✅ done · 🧪 for testing · 🚧 in progress · 📋 planned · 🔵 open · ❌ cancelled. See [`.agent/skills/workflow-intake-scratchpads/SKILL.md`](../../.agent/skills/workflow-intake-scratchpads/SKILL.md). Checked by `scripts/dev/check-workflow-scratchpads.sh` on commit when a scratchpad is staged.

**Folder = stage.** Update frontmatter **and** move the file when status changes. Use `bash scripts/dev/workflow-move.sh start|for-testing|done|wont-do <slug>`.

**Frontmatter:** `title`, `status`, `tags`, `updated` (YYYY-MM-DD), `stage`, `kind: plan`. **No `YYYY-MM-DD-` filename prefixes.**

**Plan sections:** Goal, Scope (in / out), Approach, Implementation tasks with file paths, Docs to update, Open questions. See [`.cursor/rules/plan-mode.mdc`](../../.cursor/rules/plan-mode.mdc).

**Commands:** `/workflow-start`, `/workflow-done`, `/workflow-wont-do`, `/workflow-sync-scratchpads`

Back to [docs index](../README.md).
