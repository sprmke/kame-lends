import { afterNavigate } from "$app/navigation";
import { updated } from "$app/stores";
import { browser } from "$app/environment";
import { get } from "svelte/store";
import { SW_MESSAGE } from "$lib/pwa/shared";
import { purgeOfflineState } from "$lib/pwa/purge";
import type { PwaState } from "$lib/pwa/pwa.svelte";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let installPromptEvent: BeforeInstallPromptEvent | null = null;

export function getInstallPromptEvent(): BeforeInstallPromptEvent | null {
  return installPromptEvent;
}

export function initPwaRegistration(state: PwaState): () => void {
  if (!browser || !import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return () => {};
  }

  let registration: ServiceWorkerRegistration | null = null;
  let updateInterval: ReturnType<typeof setInterval> | null = null;

  const onBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    installPromptEvent = event as BeforeInstallPromptEvent;
    state.installAvailable = true;
  };

  const onAppInstalled = () => {
    installPromptEvent = null;
    state.installAvailable = false;
    state.standalone = true;
  };

  const checkForUpdate = async () => {
    try {
      await registration?.update();
    } catch {
      /* optional */
    }
    if (get(updated)) {
      state.updateReady = true;
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState !== "visible") return;
    void checkForUpdate();
    if ("clearAppBadge" in navigator) {
      void navigator.clearAppBadge?.();
    }
  };

  const onControllerChange = () => {
    if (registration?.waiting) return;
    location.reload();
  };

  const onMessage = (event: MessageEvent) => {
    const type = (event.data as { type?: string } | null)?.type;
    if (type === SW_MESSAGE.KILLED) {
      void purgeOfflineState().then(() => location.reload());
    }
    if (type === SW_MESSAGE.PUSH_RESYNC) {
      window.dispatchEvent(new CustomEvent("kl:push-resync"));
    }
    if (type === SW_MESSAGE.NOTIFICATION_CLICK) {
      const path = (event.data as { path?: string }).path;
      if (path) window.location.assign(path);
    }
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
  document.addEventListener("visibilitychange", onVisibilityChange);
  navigator.serviceWorker.addEventListener("message", onMessage);

  void (async () => {
    registration = await navigator.serviceWorker.register("/service-worker.js");
    registration.addEventListener("updatefound", () => {
      const worker = registration?.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          state.updateReady = true;
        }
      });
    });
    if (registration.waiting && navigator.serviceWorker.controller) {
      state.updateReady = true;
    }
    updateInterval = setInterval(() => void checkForUpdate(), 60 * 60 * 1000);
    if ("storage" in navigator && "persist" in navigator.storage) {
      void navigator.storage.persist();
    }
  })();

  afterNavigate(() => {
    void checkForUpdate();
  });

  navigator.serviceWorker.addEventListener(
    "controllerchange",
    onControllerChange,
  );

  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    navigator.serviceWorker.removeEventListener("message", onMessage);
    navigator.serviceWorker.removeEventListener(
      "controllerchange",
      onControllerChange,
    );
    if (updateInterval) clearInterval(updateInterval);
    installPromptEvent = null;
  };
}

export async function promptInstall(
  deferred: BeforeInstallPromptEvent | null = getInstallPromptEvent(),
): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const choice = await deferred.userChoice;
  if (choice.outcome === "accepted") {
    installPromptEvent = null;
  }
  return choice.outcome === "accepted";
}

export async function applyServiceWorkerUpdate(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.waiting?.postMessage({ type: SW_MESSAGE.SKIP_WAITING });
  if (!registration?.waiting) {
    location.reload();
  }
}
