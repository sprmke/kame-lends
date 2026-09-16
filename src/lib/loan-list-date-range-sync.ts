/** True when URL params should not overwrite in-memory navigation (local change ahead of replaceState). */
export function shouldSkipUrlToDateNavSync(input: {
  urlFrom: string | null;
  urlTo: string | null;
  navFrom: string;
  navTo: string;
  pendingFrom: string | null;
  pendingTo: string | null;
  pendingAllTime: boolean;
  urlIsAllTime: boolean;
}): boolean {
  if (input.pendingAllTime) {
    return !input.urlIsAllTime;
  }
  if (!input.pendingFrom || !input.pendingTo) return false;
  if (input.urlFrom === input.pendingFrom && input.urlTo === input.pendingTo) {
    return false;
  }
  return input.navFrom === input.pendingFrom && input.navTo === input.pendingTo;
}
