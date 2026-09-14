export type GoogleCalendarConfig = {
  clientEmail: string;
  privateKey: string;
  calendarId: string;
};

type EnvSource = Record<string, string | undefined>;

function readValue(source: EnvSource, name: string): string | undefined {
  const value = source[name];
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function readGoogleCalendarConfig(
  source: EnvSource,
): GoogleCalendarConfig | null {
  const clientEmail = readValue(source, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawKey = readValue(source, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  const calendarId = readValue(source, "GOOGLE_CALENDAR_ID");

  if (!clientEmail || !rawKey || !calendarId) {
    return null;
  }

  return {
    clientEmail,
    privateKey: rawKey.replace(/\\n/g, "\n"),
    calendarId,
  };
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
