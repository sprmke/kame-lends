/**
 * SvelteKit's replaceState throws in dev, and can corrupt history in prod,
 * if it runs while the page is still hydrating (`started` is still false).
 * Queue those writes until a macrotask, which is after the client router starts.
 */
export function createDeferredReplaceState(
  replace: (href: string, state: unknown) => void,
  schedule: (run: () => void) => void,
) {
  let ready = false;
  const pending: Array<{ href: string; state: unknown }> = [];

  schedule(() => {
    ready = true;
    const queued = pending.splice(0);
    for (const item of queued) replace(item.href, item.state);
  });

  return function replaceWhenReady(href: string, state: unknown) {
    if (!ready) {
      pending.push({ href, state });
      return;
    }
    replace(href, state);
  };
}
