import { browser } from "$app/environment";

export type PwaState = {
  offline: boolean;
  updateReady: boolean;
  installAvailable: boolean;
  standalone: boolean;
  pushEnabled: boolean;
};

function readStandalone(): boolean {
  if (!browser) return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function createPwaState(): PwaState {
  const state = $state<PwaState>({
    offline: browser ? !navigator.onLine : false,
    updateReady: false,
    installAvailable: false,
    standalone: readStandalone(),
    pushEnabled: false,
  });
  return state;
}
