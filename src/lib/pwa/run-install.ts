import { isIosBrowser } from "$lib/pwa/install";
import { getInstallPromptEvent, promptInstall } from "$lib/pwa/register";
import type { PwaContextValue } from "$lib/pwa/pwa-context";

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
