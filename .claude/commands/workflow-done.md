# Workflow done

Mark the active **in-progress** workflow doc as **done**.

## Steps

1. Identify the in-progress slug from `docs/workflow/in-progress/` or user message.
2. Run:

```bash
bash scripts/dev/workflow-move.sh done <slug>
```

3. Confirm docs/route guides/`PROJECT.md` updates were made — invoke **`documentation-maintenance`** (+ **`route-guides`** if pages changed). See `.cursor/rules/documentation-maintenance.mdc` and `CLAUDE.md` § Docs are the source of truth.
4. Sync scratchpads: `bun run sync:workflow-scratchpads -- --slug=<slug>` and add the `→ **Done:**` link on the matching item.
