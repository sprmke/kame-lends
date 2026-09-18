import { browser } from "$app/environment";

export function supportsServiceWorker(): boolean {
  return browser && "serviceWorker" in navigator;
}

export function supportsInstallPrompt(): boolean {
  return browser && "BeforeInstallPromptEvent" in window;
}

export function supportsWebShare(): boolean {
  return browser && typeof navigator.share === "function";
}

export function supportsPush(): boolean {
  return browser && "PushManager" in window && "Notification" in window;
}

export function supportsPeriodicSync(): boolean {
  return (
    browser &&
    "serviceWorker" in navigator &&
    "periodicSync" in ServiceWorkerRegistration.prototype
  );
}

export function isStandaloneDisplay(): boolean {
  if (!browser) return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function needsInstallBeforePush(): boolean {
  if (!browser) return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  return isIos && !isStandaloneDisplay();
}
