import type { Snippet } from "svelte";

/**
 * PageHeader / DetailHeader register their action snippet here on the mobile
 * shell so MobileTopBar can render it in the brand hero (single instance).
 */
class MobileHeaderActionsStore {
  snippet = $state<Snippet | null>(null);

  set(snippet: Snippet | null) {
    this.snippet = snippet;
  }

  clear() {
    this.snippet = null;
  }
}

export const mobileHeaderActions = new MobileHeaderActionsStore();
