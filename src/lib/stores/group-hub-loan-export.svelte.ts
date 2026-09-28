import type { Snippet } from "svelte";

/** Loans tab embed registers Export PDF here; GroupHubHeader renders it beside Add loans. */
class GroupHubLoanExportStore {
  snippet = $state<Snippet | null>(null);

  set(snippet: Snippet | null) {
    this.snippet = snippet;
  }

  clear() {
    this.snippet = null;
  }
}

export const groupHubLoanExportActions = new GroupHubLoanExportStore();
