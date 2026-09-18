/** Turn a boolean signal on only after it stays true for `delayMs` (avoids flash on fast changes). */
export function createDelayedFlag(source: () => boolean, delayMs = 120) {
  let active = $state(false);

  $effect(() => {
    const on = source();
    if (!on) {
      active = false;
      return;
    }

    const id = setTimeout(() => {
      active = true;
    }, delayMs);

    return () => clearTimeout(id);
  });

  return {
    get active() {
      return active;
    },
  };
}
