import { browser } from "$app/environment";
import { OFFLINE_ERROR_MESSAGE } from "$lib/pwa/shared";

export const OFFLINE_MUTATION_EVENT = "kl:offline-mutation";

function notifyOfflineMutation(): void {
  window.dispatchEvent(new CustomEvent(OFFLINE_MUTATION_EVENT));
}

let fetchPatchInstalled = false;

export function isOfflineMutationResponse(
  status: number,
  body: unknown,
): boolean {
  if (status !== 503 || typeof body !== "object" || body === null) return false;
  return (
    "error" in body &&
    (body as { error?: string }).error === OFFLINE_ERROR_MESSAGE
  );
}

export function initOfflineFetchHandler(): () => void {
  if (!browser || fetchPatchInstalled) return () => {};

  fetchPatchInstalled = true;
  document.documentElement.dataset.offlineFetch = "1";

  const original = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const init = args[1];
    const method = (init?.method ?? "GET").toUpperCase();

    try {
      const response = await original(...args);
      if (response.status !== 503) return response;

      try {
        const body = await response.clone().json();
        if (isOfflineMutationResponse(response.status, body)) {
          notifyOfflineMutation();
        }
      } catch {
        /* not JSON */
      }

      return response;
    } catch (error) {
      if (!navigator.onLine && method !== "GET") {
        notifyOfflineMutation();
      }
      throw error;
    }
  };

  return () => {
    window.fetch = original;
    fetchPatchInstalled = false;
    delete document.documentElement.dataset.offlineFetch;
  };
}
