import { isMobileShellViewport } from "$lib/composables/use-media-query.svelte";

export const GRID_CARD_ACTIONS_ATTR = "data-grid-card-actions";

export function shouldIgnoreGridCardTap(
  event: MouseEvent | KeyboardEvent,
  extraSelectors: string[] = [],
): boolean {
  const target = event.target as HTMLElement;
  if (target.closest(`[${GRID_CARD_ACTIONS_ATTR}]`)) return true;
  if (target.closest("button") || target.closest("a")) return true;
  for (const selector of extraSelectors) {
    if (target.closest(selector)) return true;
  }
  return false;
}

export function handleGridCardKeydown(
  event: KeyboardEvent,
  onActivate: (event: KeyboardEvent) => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onActivate(event);
}

/** Card surface opens the item; ignores menu, links, and extra selectors (e.g. bulk select). */
export function activateGridCard(
  event: MouseEvent | KeyboardEvent,
  onActivate: () => void,
  extraSelectors: string[] = [],
) {
  if (shouldIgnoreGridCardTap(event, extraSelectors)) return;
  onActivate();
}

/** @deprecated Use {@link activateGridCard}. Kept for call sites that gated on mobile only. */
export function activateGridCardOnMobile(
  event: MouseEvent | KeyboardEvent,
  onActivate: () => void,
  extraSelectors: string[] = [],
) {
  activateGridCard(event, onActivate, extraSelectors);
}

/** Row/card open: navigate on phone shell, caller decides desktop (e.g. modal). */
export function isGridCardPhoneNavigation(): boolean {
  return isMobileShellViewport();
}
