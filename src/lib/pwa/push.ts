import { browser } from "$app/environment";
import { publicVapidKey } from "$lib/public-env";
import { needsInstallBeforePush } from "$lib/pwa/capabilities";

export type PushClientState = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  needsInstallFirst: boolean;
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function getPushState(): Promise<PushClientState> {
  if (!browser || !("PushManager" in window) || !("Notification" in window)) {
    return {
      supported: false,
      permission: "unsupported",
      subscribed: false,
      needsInstallFirst: false,
    };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    supported: Boolean(publicVapidKey()),
    permission: Notification.permission,
    subscribed: Boolean(subscription),
    needsInstallFirst: needsInstallBeforePush(),
  };
}

export async function enablePush(): Promise<boolean> {
  const key = publicVapidKey();
  if (!browser || !key) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    }),
  });

  return response.ok;
}

export async function disablePush(): Promise<boolean> {
  if (!browser) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const response = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  return response.ok;
}

export async function resyncPushSubscription(): Promise<void> {
  if (!browser) return;
  const state = await getPushState();
  if (!state.subscribed || !state.supported) return;
  await enablePush();
}
