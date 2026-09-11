import { tick } from "svelte";

/**
 * Defers mounting heavy overlay body content until after the shell has painted.
 * Keeps sheet/dialog open animations responsive on mobile and desktop.
 */
export function createOverlayContentReady() {
  let ready = $state(false);
  let openToken = 0;

  function reset() {
    openToken += 1;
    ready = false;
  }

  function armWhenOpen(open: boolean) {
    if (!open) {
      reset();
      return;
    }

    const token = ++openToken;
    ready = false;

    void tick().then(() => {
      if (token === openToken) ready = true;
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
