import { browser } from "$app/environment";
import { overlayStackIsOpen } from "$lib/composables/overlay-stack.svelte";

/**
 * Bits UI `BodyScrollLock` can leave `document.body` with `overflow: hidden` and
 * `pointer-events: none` if a dialog unmounts before its close animation finishes.
 * Clear those when no dashboard overlay is registered on our stack.
 */
export function releaseStaleBodyScrollLock() {
  if (!browser || overlayStackIsOpen()) return;

  const body = document.body;
  const locked =
    body.style.overflow === "hidden" || body.style.pointerEvents === "none";

  if (!locked) return;

  body.style.removeProperty("overflow");
  body.style.removeProperty("pointer-events");
  body.style.removeProperty("padding-right");
  body.style.removeProperty("margin-right");
  body.style.removeProperty("--scrollbar-width");
}
