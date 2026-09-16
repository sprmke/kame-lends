import { env } from "$env/dynamic/private";

export type TelegramConfig = {
  botToken: string;
  botUsername: string;
  webhookSecret: string;
};

function readEnv(name: string): string | undefined {
  const fromKit = env[name as keyof typeof env];
  const value =
    (typeof fromKit === "string" ? fromKit : undefined) ?? process.env[name];
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readTelegramConfig(): TelegramConfig | null {
  const botToken = readEnv("TELEGRAM_BOT_TOKEN");
  const botUsername = readEnv("TELEGRAM_BOT_USERNAME");
  const webhookSecret = readEnv("TELEGRAM_WEBHOOK_SECRET");

  if (!botToken || !botUsername || !webhookSecret) {
    return null;
  }

  return {
    botToken,
    botUsername: botUsername.replace(/^@/, ""),
    webhookSecret,
  };
}

export function isTelegramConfigured(): boolean {
  return readTelegramConfig() !== null;
}

/** Env bot token only (no username/webhook required). */
export function hasEnvTelegramBotToken(): boolean {
  return Boolean(readEnv("TELEGRAM_BOT_TOKEN"));
}

export function readEnvTelegramBotUsername(): string | undefined {
  const username = readEnv("TELEGRAM_BOT_USERNAME");
  return username?.replace(/^@/, "");
}

/** Per-group stored token, else env `TELEGRAM_BOT_TOKEN`. */
export function resolveGroupBotToken(stored?: string | null): string | null {
  const group = stored?.trim();
  if (group) return group;
  const envToken = readEnv("TELEGRAM_BOT_TOKEN");
  return envToken ?? null;
}

export function isTelegramBotAvailable(stored?: string | null): boolean {
  return resolveGroupBotToken(stored) !== null;
}
