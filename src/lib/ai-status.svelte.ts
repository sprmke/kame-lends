import { browser } from "$app/environment";

/** Mirrors `AiStatus` from `$lib/server/ai/config` (client-safe copy). */
interface AiStatusResponse {
  enabled: boolean;
  features: Record<string, boolean>;
}

const state = $state({ loaded: false, receiptExtraction: false });
let request: Promise<void> | null = null;

function load(): Promise<void> {
  request ??= fetch("/api/ai/status")
    .then((response) => (response.ok ? response.json() : null))
    .then((body: AiStatusResponse | null) => {
      state.receiptExtraction = Boolean(body?.features?.receipt_extraction);
    })
    .catch(() => {
      state.receiptExtraction = false;
      request = null;
    })
    .finally(() => {
      state.loaded = true;
    });
  return request;
}

/**
 * Which AI features the UI may offer. Fetched once per page load; false until
 * loaded and when offline, so AI buttons never appear for a disabled backend.
 */
export function useAiStatus() {
  if (browser) void load();
  return {
    get loaded() {
      return state.loaded;
    },
    get receiptExtraction() {
      return state.receiptExtraction;
    },
    /** Resolves once the status is known (use before deciding to call AI). */
    ready(): Promise<void> {
      return browser ? load() : Promise.resolve();
    },
  };
}
