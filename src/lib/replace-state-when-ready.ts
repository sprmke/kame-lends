import { replaceState } from "$app/navigation";
import { createDeferredReplaceState } from "$lib/deferred-replace-state";

const replaceNow =
  typeof window === "undefined"
    ? () => {}
    : createDeferredReplaceState(
        (href, state) => {
          // href is always built from in-app pathname + search (list filters, date range).
          // eslint-disable-next-line svelte/no-navigation-without-resolve -- not a typed route id
          replaceState(href, state as App.PageState);
        },
        (run) => {
          setTimeout(run, 0);
        },
      );

/** replaceState after hydration, so the client router is already started. */
export function replaceStateWhenRouterReady(
  href: string,
  state: App.PageState,
) {
  replaceNow(href, state);
}
