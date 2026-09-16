/**
 * Register the Telegram bot webhook for the deployed app.
 *
 * Usage:
 *   bun run telegram:set-webhook
 *
 * Requires TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, PUBLIC_APP_URL
 * (from .env.local or the environment).
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

import { readTelegramConfig } from "../../src/lib/server/telegram/config";
import { setWebhook } from "../../src/lib/server/telegram/api";

const appUrl = process.env.PUBLIC_APP_URL?.trim();
if (!appUrl) {
  console.error("PUBLIC_APP_URL is required");
  process.exit(1);
}

const config = readTelegramConfig();
if (!config) {
  console.error(
    "Set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, and TELEGRAM_WEBHOOK_SECRET",
  );
  process.exit(1);
}

const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/telegram`;

const ok = await setWebhook({
  url: webhookUrl,
  secretToken: config.webhookSecret,
  dropPendingUpdates: true,
});

if (!ok) {
  console.error("setWebhook returned false");
  process.exit(1);
}

console.log(`Webhook set: ${webhookUrl}`);
