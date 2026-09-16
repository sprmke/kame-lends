import { tick, untrack } from "svelte";

/**
 * Defers mounting heavy overlay body content until after the shell has painted.
 * Only heavy overlays should use this (loan form/detail). Light dialogs should
 * render their body immediately.
 *
 * `armWhenOpen` is rising-edge: re-calling it while still open must not reset
 * `ready`, or the skeleton stays up and rAF callbacks never match.
 */
export function createOverlayContentReady() {
  let ready = $state(false);
  let openToken = 0;
  let armed = false;
  let outerRaf = 0;
  let innerRaf = 0;

  function cancelPaint() {
    if (outerRaf) cancelAnimationFrame(outerRaf);
    if (innerRaf) cancelAnimationFrame(innerRaf);
    outerRaf = 0;
    innerRaf = 0;
  }

  function reset() {
    cancelPaint();
    openToken += 1;
    armed = false;
    untrack(() => {
      ready = false;
    });
  }

  function armWhenOpen(open: boolean) {
    if (!open) {
      reset();
      return;
    }

    if (armed) return;
    armed = true;
    const token = ++openToken;
    untrack(() => {
      ready = false;
    });

    void tick().then(() => {
      if (token !== openToken) return;
      outerRaf = requestAnimationFrame(() => {
        innerRaf = requestAnimationFrame(() => {
          if (token === openToken) {
            untrack(() => {
              ready = true;
            });
          }
        });
      });
    });
  }

  return {
    get ready() {
      return ready;
    },
    armWhenOpen,
    reset,
  };
}
