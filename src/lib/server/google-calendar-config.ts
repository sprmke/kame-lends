export type GoogleServiceAccountCredentials = {
  clientEmail: string;
  privateKey: string;
};

export type GoogleCalendarConfig = GoogleServiceAccountCredentials & {
  calendarId: string;
};

type EnvSource = Record<string, string | undefined>;

function readValue(source: EnvSource, name: string): string | undefined {
  const value = source[name];
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Service account only — enough to create/manage calendars. */
export function readGoogleServiceAccountCredentials(
  source: EnvSource,
): GoogleServiceAccountCredentials | null {
  const clientEmail = readValue(source, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawKey = readValue(source, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!clientEmail || !rawKey) return null;
  return {
    clientEmail,
    privateKey: rawKey.replace(/\\n/g, "\n"),
  };
}

export function readGoogleCalendarConfig(
  source: EnvSource,
): GoogleCalendarConfig | null {
  const credentials = readGoogleServiceAccountCredentials(source);
  const calendarId = readValue(source, "GOOGLE_CALENDAR_ID");
  if (!credentials || !calendarId) return null;
  return { ...credentials, calendarId };
}

export class GoogleCalendarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCalendarError";
  }
}

type GoogleErrorBody = {
  message?: string;
  error_description?: string;
  errors?: Array<{ message?: string; reason?: string }>;
};

function fromGoogleErrorBody(
  body: GoogleErrorBody | string | undefined,
): string | null {
  if (!body) return null;
  if (typeof body === "string") return body;

  const reason = body.errors?.[0]?.reason;
  const nestedMessage = body.errors?.[0]?.message;
  const message = body.message || body.error_description || nestedMessage;
  if (reason && message) return `${reason}: ${message}`;
  return message || reason || null;
}

export function formatGoogleCalendarApiError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return typeof error === "string" ? error : "Unknown Google Calendar error";
  }

  const err = error as {
    message?: string;
    errors?: Array<{ message?: string; reason?: string }>;
    response?: {
      data?: {
        error?: GoogleErrorBody | string;
        error_description?: string;
      };
    };
  };

  const fromResponse =
    fromGoogleErrorBody(err.response?.data?.error) ||
    err.response?.data?.error_description;
  if (fromResponse) {
    if (
      err.message &&
      fromResponse !== err.message &&
      !err.message.includes(fromResponse)
    ) {
      return `${err.message} (${fromResponse})`;
    }
    return err.message?.includes(fromResponse) ? err.message : fromResponse;
  }

  const fromErrors = fromGoogleErrorBody({ errors: err.errors });
  if (fromErrors) return fromErrors;

  return err.message || "Unknown Google Calendar error";
}

export function isGoogleCalendarNotFoundError(error: unknown): boolean {
  return /notFound|\b404\b/i.test(formatGoogleCalendarApiError(error));
}

export function formatGoogleCalendarApiErrorWithConfig(
  error: unknown,
  config: GoogleCalendarConfig | null,
): string {
  const formatted = formatGoogleCalendarApiError(error);
  if (config && isGoogleCalendarNotFoundError(error)) {
    return `Calendar not found or not shared with ${config.clientEmail}. In Google Calendar, share the calendar used in GOOGLE_CALENDAR_ID with that address and grant Make changes to events. (${formatted})`;
  }
  return formatted;
}

const RATE_LIMIT_RE =
  /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|rate limit exceeded/i;

export function isGoogleCalendarRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return typeof error === "string" && RATE_LIMIT_RE.test(error);
  }

  const err = error as {
    code?: number | string;
    status?: number;
    errors?: Array<{ reason?: string }>;
    response?: { status?: number; data?: { error?: GoogleErrorBody | string } };
  };
  const reason =
    err.errors?.[0]?.reason ||
    (typeof err.response?.data?.error === "object"
      ? err.response.data.error.errors?.[0]?.reason
      : undefined);
  if (
    reason === "rateLimitExceeded" ||
    reason === "userRateLimitExceeded" ||
    reason === "quotaExceeded"
  ) {
    return true;
  }
  if (err.code === 429 || err.status === 429 || err.response?.status === 429) {
    return true;
  }
  return RATE_LIMIT_RE.test(formatGoogleCalendarApiError(error));
}

export type GoogleCalendarRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export async function withGoogleCalendarRetry<T>(
  operation: () => Promise<T>,
  options: GoogleCalendarRetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 6;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isGoogleCalendarRateLimitError(error) || attempt === retries) {
        throw error;
      }
      await sleep(Math.min(30_000, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}
