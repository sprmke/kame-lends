import { browser } from "$app/environment";
import {
  isStandaloneDisplay,
  supportsInstallPrompt,
} from "$lib/pwa/capabilities";
import { installDismissed, recordInstallDismissal } from "$lib/pwa/shared";

export function shouldShowInstallPrompt(): boolean {
  if (!browser || isStandaloneDisplay()) return false;
  if (installDismissed()) return false;
  return supportsInstallPrompt() || isIosSafari();
}

/** Any iOS browser (Safari, Chrome, etc.). Install is manual via Share → Add to Home Screen. */
export function isIosBrowser(): boolean {
  if (!browser) return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) &&
    !(window as Window & { MSStream?: unknown }).MSStream
  );
}

/** @deprecated Use isIosBrowser */
export function isIosSafari(): boolean {
  return isIosBrowser();
}

export function dismissInstallPrompt(): void {
  recordInstallDismissal();
}
