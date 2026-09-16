---
name: mobile-responsive
description: Native mobile patterns for Kame Lends — sheets, overflow menus, shell breakpoint. Use when changing UI in src/.
---

# Mobile-responsive — Kame Lends

Shell breakpoint: **`lg` (1024px)**. Phone/tablet = `max-width: 1023px` (`createIsMobileShell`, `isMobileShellViewport()`).

## Overflow menus (⋯)

**Never** mount `DropdownMenu` for row/hero/toolbar overflow on viewports under `lg`.

Use **`ResponsiveOverflowMenu.svelte`**:

```svelte
<ResponsiveOverflowMenu items={actionItems} ariaLabel="More actions" sheetTitle="Actions">
  {#snippet trigger({ props })}
    <Button {...props} variant="ghost" size="sm" aria-label="More actions">
      <MoreVertical />
    </Button>
  {/snippet}
</ResponsiveOverflowMenu>
```

- **Phone:** bottom sheet (`ActionSheetList`, min-h-11 rows, safe-area padding).
- **Desktop:** `DropdownMenu` + `ActionMenuList`.
- Items: `RowActionItem[]` from `action-buttons.ts` (`icon`, `lucideIcon`, `destructive`, `separatorBefore`).

Canonical loan row menu: `createLoanActionItems()` + `loanListRowActionHandlers()`.

## Modals

- Forms, confirms, pickers: **`ResponsiveModal`** (sheet under `lg`, dialog at `lg+`).
- Light dialogs: `deferBody` off. Heavy loan create/detail: defer internally (`overlay-performance` skill).

## List → detail

Under `lg`, list row/card tap navigates to detail route (`/loans/[id]`, etc.), not an in-place quick-view modal.

## Touch + safe area

- `touch-target` / `min-h-11` on tappable chrome.
- Sheet footers: `pb-[max(0.5rem,var(--safe-area-bottom))]`.
- `viewport-fit=cover` + `env(safe-area-inset-*)` in `src/lib/styles/mobile.css`.

## Popovers (filters, selects)

Filter popovers (`MultiSelectFilter`, `DateRangeFilter`, `SearchableSelect`) are a separate pass. New **action** or **option** menus must use sheets on phone, not floating panels.

## Verify

1. Chrome DevTools 375px: tap ⋯ on a loan card → bottom sheet with Add Commission / Contract Details.
2. 1280px: same trigger → anchored dropdown.
3. No dropdown panel clipped off-screen on phone.

## Related

- Rule: `.cursor/rules/mobile-native-ui.mdc`
- Plan: `docs/workflow/planned/mobile-native-redesign.md`
- Overlay jank: `overlay-performance` skill
