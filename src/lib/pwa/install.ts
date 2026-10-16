import { browser } from "$app/environment";
import { isStandaloneDisplay } from "$lib/pwa/capabilities";
import { installDismissed, recordInstallDismissal } from "$lib/pwa/shared";

/** True when our install controls can finish: Chromium deferred prompt, or iOS Add to Home Screen. */
export function canOfferInstall(input: {
  standalone: boolean;
  ios: boolean;
  installAvailable: boolean;
}): boolean {
  if (input.standalone) return false;
  return input.ios || input.installAvailable;
}

export function shouldShowInstallPrompt(installAvailable = false): boolean {
  if (!browser || installDismissed()) return false;
  return canOfferInstall({
    standalone: isStandaloneDisplay(),
    ios: isIosBrowser(),
    installAvailable,
  });
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
