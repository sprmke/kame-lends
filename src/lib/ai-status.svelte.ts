import { browser } from "$app/environment";

/** Mirrors `AiStatus` from `$lib/server/ai/config` (client-safe copy). */
interface AiStatusResponse {
  enabled: boolean;
  features: Record<string, boolean>;
  reason?: string | null;
}

const state = $state({
  loaded: false,
  receiptExtraction: false,
  assistantChat: false,
  enabled: false,
  reason: null as string | null,
});
let request: Promise<void> | null = null;

function load(): Promise<void> {
  request ??= fetch("/api/ai/status")
    .then((response) => (response.ok ? response.json() : null))
    .then((body: AiStatusResponse | null) => {
      state.receiptExtraction = Boolean(body?.features?.receipt_extraction);
      state.assistantChat = Boolean(body?.features?.assistant_chat);
      state.enabled = Boolean(body?.enabled);
      state.reason = body?.reason ?? null;
    })
    .catch(() => {
      state.receiptExtraction = false;
      state.assistantChat = false;
      state.enabled = false;
      state.reason = null;
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
    get assistantChat() {
      return state.assistantChat;
    },
    get enabled() {
      return state.enabled;
    },
    get reason() {
      return state.reason;
    },
    /** Resolves once the status is known (use before deciding to call AI). */
    ready(): Promise<void> {
      return browser ? load() : Promise.resolve();
    },
  };
}
