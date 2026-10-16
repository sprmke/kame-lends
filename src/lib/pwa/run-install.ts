import { browser } from "$app/environment";
import { isStandaloneDisplay } from "$lib/pwa/capabilities";
import { canOfferInstall, isIosBrowser } from "$lib/pwa/install";
import { getInstallPromptEvent, promptInstall } from "$lib/pwa/register";
import type { PwaContextValue } from "$lib/pwa/pwa-context";

/** Sidebar, account sheet, and Settings card. False until the browser can install. */
export function installUiAvailable(
  pwaCtx: PwaContextValue | undefined,
): boolean {
  if (!browser) return false;
  return canOfferInstall({
    standalone: isStandaloneDisplay(),
    ios: isIosBrowser(),
    installAvailable:
      Boolean(pwaCtx?.state.installAvailable) ||
      Boolean(getInstallPromptEvent()),
  });
}

export type RunInstallResult =
  "accepted" | "ios-help" | "unavailable" | "dismissed";

/** Native install prompt (Chromium) or signal iOS manual steps. Never navigates away. */
export async function runInstallAction(
  pwaCtx: PwaContextValue | undefined,
): Promise<RunInstallResult> {
  if (isIosBrowser()) {
    return "ios-help";
  }

  const hadDeferred =
    Boolean(pwaCtx?.state.installAvailable) || Boolean(getInstallPromptEvent());

  const accepted = pwaCtx ? await pwaCtx.installApp() : await promptInstall();

  if (accepted) return "accepted";
  if (!hadDeferred) return "unavailable";
  return "dismissed";
}
