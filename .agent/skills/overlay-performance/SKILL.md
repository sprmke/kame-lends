---
name: overlay-performance
description: Prevent modal, dialog, and sheet jank. Use when adding or changing ResponsiveModal, Dialog, Sheet, overlays, backdrop-filter, overlay-open, or createOverlayContentReady.
---

# Overlay performance — Kame Lends

Use when creating or changing any overlay (dialog, sheet, alert, picker, wizard).

## Why this exists

Dashboard overlays have frozen the UI more than once:

1. **Scrim blur** over a large list (loans table) is a full-viewport filter every frame.
2. **Deferred modal bodies** (`tick` + double-rAF) applied to _every_ `ResponsiveModal`, including light forms. Re-arming that deferral resets `ready` and can leave the 3-bar skeleton up forever.
3. **`transition-all` + `backdrop-blur`** on the sidebar interpolates blur when `html.overlay-open` toggles it off.

## Checklist

1. Scrim is a **solid tint**. No `backdrop-blur` on `[data-slot$="-overlay"]` under `html.dashboard-shell`.
2. Sidebar/dock: never `transition-all` if the node uses `backdrop-filter`. Overlay-open already forces `transition: none`.
3. `ResponsiveModal` **`deferBody` defaults to false**. Set true only for a heavy tree (loan create/detail). New group, pickers, and confirms stay eager.
4. If you use `createOverlayContentReady`, call `armWhenOpen` as a rising edge. The helper must ignore re-entry while still open.
5. Open-init `$effect` must `untrack()` writes. Do not let `usedColorKeys={x ?? []}` (new `[]` every render) retrigger init.
6. Do not add `isolate` on full-viewport overlay frames. `z-index` is enough.
7. `html.overlay-open .app-shell { content-visibility: hidden }` is already global. Do not also hide the portaled overlay. Dialog content portals to `body`.
8. Never `{#await import()}` in an overlay template. `import()` is a new Promise on every parent render, so the await block remounts the child. Combined with a child `$effect` that writes back (`onRegisterSave`, stats, dirty), this infinite-loops and freezes the UI on the 3-bar skeleton. Store the module on `$state` from an `$effect` after `armWhenOpen` (see `LoanCreateModal`, `LoanContractDetailsModal`).
9. Bits UI scroll-lock can leave `body { overflow: hidden; pointer-events: none }` if the dialog unmounts before close finishes. `Dialog.Root` / `Sheet.Root` wrappers implement `onOpenChangeComplete` (~320ms after `open` goes false) and call `releaseStaleBodyScrollLock()`. Parents that `{#if}` the modal must clear loan/state in `onOpenChangeComplete`, not in the same tick as `onOpenChange(false)`.

## New group / light wizard

Mount the real step-1 form immediately. Do not gate it on `overlayContent.ready`. Filter large loan lists only on the step that renders them.

## Heavy overlay pattern

Lazy-load the heavy child **inside** the modal (`import()` from `$effect` into `$state`, plus `createOverlayContentReady`). Do not hide a small form behind the shared shell skeleton. Do not `{#await import()}` in the snippet.

## Verify

Open the overlay and confirm: title, fields, and footer paint in the first frames (no muted 3-bar placeholder), typing is smooth, close is smooth. Check a second overlay on `/loans` so the heavy path still defers internally.
