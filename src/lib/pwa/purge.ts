import { browser } from "$app/environment";
import { DATA_CACHE, PAGES_CACHE, SW_MESSAGE } from "$lib/pwa/shared";

export async function purgeOfflineState(): Promise<void> {
  if (!browser) return;

  await Promise.all([caches.delete(PAGES_CACHE), caches.delete(DATA_CACHE)]);

  const registration = await navigator.serviceWorker?.getRegistration();
  registration?.active?.postMessage({ type: SW_MESSAGE.PURGE_OFFLINE });

  if ("serviceWorker" in navigator && "PushManager" in window) {
    try {
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
    } catch {
      /* optional */
    }
  }

  if ("clearAppBadge" in navigator) {
    try {
      await navigator.clearAppBadge();
    } catch {
      /* optional */
    }
  }
}
