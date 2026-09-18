import webpush from "web-push";
import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

let configured = false;

function readPrivateKey(): string | undefined {
  return env.VAPID_PRIVATE_KEY?.trim() || process.env.VAPID_PRIVATE_KEY?.trim();
}

export function publicVapidKey(): string | undefined {
  return (
    publicEnv.PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    process.env.PUBLIC_VAPID_PUBLIC_KEY?.trim()
  );
}

export function isPushConfigured(): boolean {
  return Boolean(readPrivateKey() && publicVapidKey() && readSubject());
}

function readSubject(): string | undefined {
  return env.VAPID_SUBJECT?.trim() || process.env.VAPID_SUBJECT?.trim();
}

export function ensureWebPushConfigured(): boolean {
  const privateKey = readPrivateKey();
  const publicKey = publicVapidKey();
  const subject = readSubject();
  if (!privateKey || !publicKey || !subject) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

export { webpush };
