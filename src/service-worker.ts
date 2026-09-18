/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";
import {
  SW_MESSAGE,
  appCacheName,
  DATA_CACHE,
  FONTS_CACHE,
  PAGES_CACHE,
  isDataRequest,
  isGoogleFontRequest,
  isImmutableAsset,
  isNeverCached,
  isOfflineApiRead,
  normalizeDataCacheKey,
  offlineJsonResponse,
  pathnameOf,
  shouldCacheNavigation,
  type PushPayload,
} from "$lib/pwa/shared";

const sw = self as unknown as ServiceWorkerGlobalScope;
const APP_CACHE = appCacheName(version);
const OFFLINE_URL = "/offline.html";
const VERSION_CHECK_URL = "/api/pwa/version";
const PRECACHE = [...build, ...files, OFFLINE_URL];

let lastVersionCheck = 0;
const VERSION_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function networkFirst(
  request: Request,
  cacheName: string,
  cacheKey?: string,
): Promise<Response> {
  const key = cacheKey ?? request.url;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      void cache.put(key, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(key);
    if (cached) return cached;
    throw new Error("network error");
  }
}

async function cacheFirst(
  request: Request,
  cacheName: string,
): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    void cache.put(request, response.clone());
  }
  return response;
}

async function purgeKlCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("kl-") || key.startsWith("workbox-"))
      .map((key) => caches.delete(key)),
  );
}

async function checkKillSwitch(): Promise<boolean> {
  try {
    const response = await fetch(VERSION_CHECK_URL, { cache: "no-store" });
    if (!response.ok) return false;
    const body = (await response.json()) as {
      disabled?: boolean;
      minVersion?: string;
    };
    if (body.disabled) return true;
    if (body.minVersion && body.minVersion > version) return true;
    return false;
  } catch {
    return false;
  }
}

async function killServiceWorker(): Promise<void> {
  await purgeKlCaches();
  const clients = await sw.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: SW_MESSAGE.KILLED });
  }
  await sw.registration.unregister();
}

sw.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await Promise.allSettled(
        PRECACHE.map(async (path) => {
          try {
            await cache.add(path);
          } catch {
            /* One bad precache URL must not fail the whole worker. */
          }
        }),
      );
    })(),
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (await checkKillSwitch()) {
        await killServiceWorker();
        return;
      }
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("kl-app-") && key !== APP_CACHE)
          .map((key) => caches.delete(key)),
      );
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener("message", (event) => {
  const type = (event.data as { type?: string } | null)?.type;
  if (type === SW_MESSAGE.SKIP_WAITING) {
    void sw.skipWaiting();
    return;
  }
  if (type === SW_MESSAGE.PURGE_OFFLINE) {
    event.waitUntil(
      Promise.all([caches.delete(PAGES_CACHE), caches.delete(DATA_CACHE)]),
    );
    return;
  }
  if (type === SW_MESSAGE.CHECK_VERSION) {
    event.waitUntil(
      (async () => {
        if (await checkKillSwitch()) await killServiceWorker();
      })(),
    );
  }
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    event.respondWith(
      (async () => {
        if (!sw.navigator.onLine) {
          return offlineJsonResponse();
        }
        try {
          return await fetch(request);
        } catch {
          return offlineJsonResponse();
        }
      })(),
    );
    return;
  }

  if (url.origin !== sw.location.origin) {
    if (isGoogleFontRequest(url)) {
      event.respondWith(cacheFirst(request, FONTS_CACHE));
    }
    return;
  }

  const pathname = pathnameOf(url);

  if (isNeverCached(pathname)) {
    return;
  }

  if (PRECACHE.includes(pathname) || isImmutableAsset(pathname)) {
    event.respondWith(cacheFirst(request, APP_CACHE));
    return;
  }

  if (isDataRequest(pathname)) {
    const cacheKey = normalizeDataCacheKey(url);
    event.respondWith(
      networkFirst(request, DATA_CACHE, cacheKey).catch(async () => {
        const cached = await caches.match(cacheKey);
        if (cached) return cached;
        return offlineJsonResponse();
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        if (Date.now() - lastVersionCheck > VERSION_CHECK_INTERVAL_MS) {
          lastVersionCheck = Date.now();
          if (await checkKillSwitch()) {
            await killServiceWorker();
            return fetch(request);
          }
        }
        try {
          const response = await fetch(request);
          if (shouldCacheNavigation(response)) {
            const cache = await caches.open(PAGES_CACHE);
            void cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
          });
        }
      })(),
    );
    return;
  }

  if (isOfflineApiRead(pathname)) {
    event.respondWith(
      networkFirst(request, DATA_CACHE, request.url).catch(async () => {
        const cached = await caches.match(request.url);
        if (cached) return cached;
        return offlineJsonResponse();
      }),
    );
  }
});

sw.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const payload = event.data?.json() as PushPayload | undefined;
      if (!payload?.title) return;
      await sw.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icon-192.png",
        badge: "/notification-badge.png",
        tag: payload.tag ?? "kame-lends",
        renotify: true,
        data: { path: payload.path ?? "/dashboard" },
      });
      if (
        typeof payload.badgeCount === "number" &&
        "setAppBadge" in sw.navigator
      ) {
        try {
          await sw.navigator.setAppBadge(payload.badgeCount);
        } catch {
          /* optional */
        }
      }
    })(),
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path =
    (event.notification.data as { path?: string } | undefined)?.path ??
    "/dashboard";
  event.waitUntil(
    (async () => {
      const clients = await sw.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if (client.url.startsWith(sw.location.origin)) {
          client.postMessage({ type: SW_MESSAGE.NOTIFICATION_CLICK, path });
          await client.focus();
          return;
        }
      }
      await sw.clients.openWindow(path);
    })(),
  );
});

sw.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const clients = await sw.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: SW_MESSAGE.PUSH_RESYNC });
      }
    })(),
  );
});
