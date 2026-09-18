/**
 * Generate VAPID keys for Web Push.
 *
 *   bun run pwa:generate-vapid-keys
 */
import { generateVAPIDKeys } from "web-push";

const keys = generateVAPIDKeys();

console.log("Add to .env.local and Vercel:");
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:you@example.com`);
console.log(`PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
