import type { PwaState } from "$lib/pwa/pwa.svelte";

export const PWA_CONTEXT_KEY = Symbol("pwa");

export type PwaContextValue = {
  readonly state: PwaState;
  installApp: () => Promise<void>;
};
