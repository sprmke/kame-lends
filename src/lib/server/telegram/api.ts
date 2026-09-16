import { readTelegramConfig } from "$lib/server/telegram/config";
import { normalizeTelegramChatId } from "$lib/server/telegram/normalize";

const TELEGRAM_API = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4096;

export class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly parameters?: { retry_after?: number; migrate_to_chat_id?: number },
  ) {
    super(message);
    this.name = "TelegramApiError";
  }
}

export class TelegramBotKickedError extends TelegramApiError {
  constructor(message: string) {
    super(message, 403);
    this.name = "TelegramBotKickedError";
  }
}

export function formatTelegramNetworkError(err: unknown): string {
  if (err instanceof TelegramApiError) return err.message;
  if (err instanceof Error) {
    if (err.name === "AbortError") return "Telegram request timed out";
    return err.message;
  }
  return "Telegram request failed";
}

type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number; migrate_to_chat_id?: number };
};

export type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  username?: string;
  first_name?: string;
};

async function callTelegram<T>(
  method: string,
  body: Record<string, unknown>,
  options: { botToken?: string; attempt?: number } = {},
): Promise<T> {
  const attempt = options.attempt ?? 0;
  const botToken =
    options.botToken?.trim() || readTelegramConfig()?.botToken || null;
  if (!botToken) {
    throw new TelegramApiError("Telegram is not configured");
  }

  const url = `${TELEGRAM_API}/bot${botToken}/${method}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new TelegramApiError(formatTelegramNetworkError(err));
  }

  const data = (await response.json()) as TelegramResponse<T>;

  if (data.ok && data.result !== undefined) {
    return data.result;
  }

  const description = data.description ?? "Telegram API error";
  const errorCode = data.error_code;

  if (errorCode === 429 && data.parameters?.retry_after != null) {
    const waitSec = data.parameters.retry_after;
    if (attempt < 3) {
      await sleep(waitSec * 1000);
      return callTelegram(method, body, {
        ...options,
        attempt: attempt + 1,
      });
    }
    throw new TelegramApiError(description, errorCode, data.parameters);
  }

  if (errorCode === 400 && data.parameters?.migrate_to_chat_id != null) {
    throw new TelegramApiError(description, errorCode, data.parameters);
  }

  if (errorCode === 403 && isBotRemovedMessage(description)) {
    throw new TelegramBotKickedError(description);
  }

  throw new TelegramApiError(description, errorCode, data.parameters);
}

function isBotRemovedMessage(description: string): boolean {
  const lower = description.toLowerCase();
  return (
    lower.includes("bot was kicked") ||
    lower.includes("bot is not a member") ||
    lower.includes("group chat was deleted") ||
    lower.includes("chat not found")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkHtml(html: string): string[] {
  if (html.length <= MAX_MESSAGE_LENGTH) return [html];
  const chunks: string[] = [];
  let rest = html;
  while (rest.length > MAX_MESSAGE_LENGTH) {
    let splitAt = rest.lastIndexOf("\n", MAX_MESSAGE_LENGTH);
    if (splitAt < MAX_MESSAGE_LENGTH * 0.5) {
      splitAt = MAX_MESSAGE_LENGTH;
    }
    chunks.push(rest.slice(0, splitAt));
    rest = rest.slice(splitAt).replace(/^\n/, "");
  }
  if (rest.length > 0) chunks.push(rest);
  return chunks;
}

export type SendMessageOptions = {
  onMigrate?: (newChatId: string) => Promise<void>;
  migrated?: boolean;
  botToken?: string;
};

export async function getMe(botToken?: string): Promise<TelegramUser> {
  return callTelegram<TelegramUser>("getMe", {}, { botToken });
}

export async function getChat(
  chatId: string,
  botToken?: string,
): Promise<TelegramChat> {
  const normalized = normalizeTelegramChatId(chatId);
  if (!normalized) throw new TelegramApiError("Invalid chat id");
  return callTelegram<TelegramChat>(
    "getChat",
    { chat_id: normalized },
    { botToken },
  );
}

export async function leaveChat(
  chatId: string,
  botToken?: string,
): Promise<boolean> {
  const normalized = normalizeTelegramChatId(chatId);
  if (!normalized) return false;
  try {
    return await callTelegram<boolean>(
      "leaveChat",
      { chat_id: normalized },
      { botToken },
    );
  } catch (err) {
    if (err instanceof TelegramBotKickedError) return true;
    throw err;
  }
}

export async function sendMessage(
  chatId: string,
  html: string,
  options: SendMessageOptions = {},
): Promise<{ messageIds: string[] }> {
  const normalized = normalizeTelegramChatId(chatId);
  if (!normalized) throw new TelegramApiError("Invalid chat id");

  const messageIds: string[] = [];
  const parts = chunkHtml(html);

  for (const part of parts) {
    try {
      const result = await callTelegram<{ message_id: number }>(
        "sendMessage",
        {
          chat_id: normalized,
          text: part,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
        { botToken: options.botToken },
      );
      messageIds.push(String(result.message_id));
    } catch (err) {
      if (
        err instanceof TelegramApiError &&
        err.parameters?.migrate_to_chat_id != null &&
        !options.migrated &&
        options.onMigrate
      ) {
        const newId = String(err.parameters.migrate_to_chat_id);
        await options.onMigrate(newId);
        return sendMessage(newId, html, {
          ...options,
          migrated: true,
        });
      }
      throw err;
    }
  }

  return { messageIds };
}

export async function setWebhook(input: {
  url: string;
  secretToken: string;
  dropPendingUpdates?: boolean;
}): Promise<boolean> {
  return callTelegram<boolean>("setWebhook", {
    url: input.url,
    secret_token: input.secretToken,
    allowed_updates: ["message", "my_chat_member"],
    drop_pending_updates: input.dropPendingUpdates ?? true,
  });
}
